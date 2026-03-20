/// Module: notarizer_v2
/// Architecture V6: "Granular Parallelism & Surgical Failover"
///
/// Key principles:
/// - Each OLT has its own shared object (OltState) -> no gas conflicts between different OLTs
/// - Oracle permissions are vectors (vector<u8>) -> surgical failover without restart
/// - Registry maintains 3 maps via Dynamic Fields
#[allow(duplicate_alias, unused_const)]
module notarization_v2::notarizer_v2 {
    use iota::event;
    use iota::dynamic_field as df;

    // =============================================
    // ERROR CODES
    // =============================================
    const ENotAuthorized: u64 = 0;
    const EAlreadyVoted: u64 = 1;
    const EOltNotFound: u64 = 3;
    const EStateAlreadyReached: u64 = 4;

    // =============================================
    // NAMESPACE KEYS for Registry Dynamic Fields
    // =============================================

    /// Key for map olt_id -> ObjectID (OltDiscovery)
    public struct OltDiscoveryKey has copy, drop, store { olt_id: u64 }

    /// Key for map olt_id -> group_id (OltToGroup)
    public struct OltGroupKey has copy, drop, store { olt_id: u64 }

    /// Key for map address -> vector<u8> (OraclePermissions)
    public struct OraclePermKey has copy, drop, store { oracle: address }

    // =============================================
    // OBJECTS
    // =============================================

    /// Admin capability: only the holder can manage the system
    public struct AdminCap has key { id: UID }

    /// Central registry: holds the configuration for the entire system
    /// Dynamic Fields:
    ///   OltDiscoveryKey { olt_id } -> ID          (ObjectID of OltState)
    ///   OltGroupKey { olt_id }     -> u8           (responsible group_id)
    ///   OraclePermKey { oracle }   -> vector<u8>   (list of authorized group_ids)
    public struct OracleRegistry has key {
        id: UID,
        threshold: u64,
    }

    /// One shared object PER OLT - eliminates any object contention between different OLTs
    public struct OltState has key {
        id: UID,
        olt_id: u64,
        group_id: u8,
        status: u8,
        last_update: u64,
        last_validator: address,
    }

    /// Collects votes for a specific state change
    /// Stored as Dynamic Field on OltState (key: target new_status)
    public struct VoteTable has store {
        voters: vector<u64>,
        target_status: u8,
    }

    // =============================================
    // EVENTS
    // =============================================
    public struct StatusEvent has copy, drop {
        olt_id: u64,
        status: u8,
        timestamp: u64,
        operator: address,
        virtual_oracle_id: u64,
        confirmed: bool,
        group_id: u8,
        last_validator: address,
    }

    public struct OltCreatedEvent has copy, drop {
        olt_id: u64,
        group_id: u8,
        object_id: ID,
    }

    // =============================================
    // INIT
    // =============================================
    fun init(ctx: &mut TxContext) {
        let admin = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin, tx_context::sender(ctx));

        let registry = OracleRegistry {
            id: object::new(ctx),
            threshold: 3,
        };
        transfer::share_object(registry);
    }

    // =============================================
    // ADMIN — SYSTEM CONFIGURATION
    // =============================================

    /// Modify the required quorum for notarization
    public entry fun set_threshold(
        _: &AdminCap,
        registry: &mut OracleRegistry,
        threshold: u64
    ) {
        registry.threshold = threshold;
    }

    /// Create a new OltState object for a single OLT and register it
    public entry fun create_olt_state(
        _: &AdminCap,
        registry: &mut OracleRegistry,
        olt_id: u64,
        group_id: u8,
        ctx: &mut TxContext
    ) {
        let olt_state = OltState {
            id: object::new(ctx),
            olt_id,
            group_id,
            status: 0,
            last_update: 0,
            last_validator: @0x0,
        };

        let obj_id = object::id(&olt_state);

        // Register olt_id -> ObjectID mapping
        let disc_key = OltDiscoveryKey { olt_id };
        if (df::exists_(&registry.id, disc_key)) {
            let existing = df::borrow_mut<OltDiscoveryKey, ID>(&mut registry.id, disc_key);
            *existing = obj_id;
        } else {
            df::add(&mut registry.id, disc_key, obj_id);
        };

        // Register olt_id -> group_id mapping
        let grp_key = OltGroupKey { olt_id };
        if (df::exists_(&registry.id, grp_key)) {
            let existing = df::borrow_mut<OltGroupKey, u8>(&mut registry.id, grp_key);
            *existing = group_id;
        } else {
            df::add(&mut registry.id, grp_key, group_id);
        };

        event::emit(OltCreatedEvent { olt_id, group_id, object_id: obj_id });

        transfer::share_object(olt_state);
    }

    // =============================================
    // ADMIN — ORACLE PERMISSION MANAGEMENT
    // =============================================

    /// Authorize an oracle to vote for a group (adds group_id to its vector)
    /// Also used for SURGICAL FAILOVER: adds an extra group to an existing oracle
    public entry fun grant_group_permission(
        _: &AdminCap,
        registry: &mut OracleRegistry,
        oracle_addr: address,
        group_id: u8
    ) {
        let perm_key = OraclePermKey { oracle: oracle_addr };
        if (!df::exists_(&registry.id, perm_key)) {
            df::add(&mut registry.id, perm_key, vector[group_id]);
        } else {
            let perms = df::borrow_mut<OraclePermKey, vector<u8>>(&mut registry.id, perm_key);
            if (!vector::contains(perms, &group_id)) {
                vector::push_back(perms, group_id);
            };
        };
    }

    /// Revoke an oracle's permission for a specific group
    public entry fun revoke_group_permission(
        _: &AdminCap,
        registry: &mut OracleRegistry,
        oracle_addr: address,
        group_id: u8
    ) {
        let perm_key = OraclePermKey { oracle: oracle_addr };
        if (df::exists_(&registry.id, perm_key)) {
            let perms = df::borrow_mut<OraclePermKey, vector<u8>>(&mut registry.id, perm_key);
            let (found, idx) = vector::index_of(perms, &group_id);
            if (found) {
                vector::remove(perms, idx);
            };
        };
    }

    /// Move an OLT to a new group (updates both Registry and OltState)
    public entry fun move_olt_to_group(
        _: &AdminCap,
        registry: &mut OracleRegistry,
        olt_state: &mut OltState,
        new_group_id: u8
    ) {
        let olt_id = olt_state.olt_id;
        olt_state.group_id = new_group_id;

        let grp_key = OltGroupKey { olt_id };
        if (df::exists_(&registry.id, grp_key)) {
            let existing = df::borrow_mut<OltGroupKey, u8>(&mut registry.id, grp_key);
            *existing = new_group_id;
        } else {
            df::add(&mut registry.id, grp_key, new_group_id);
        };
    }

    // =============================================
    // NOTARIZATION — V6 CORE
    // =============================================

    /// Notarizes the state of a single OLT in parallel.
    /// Each OLT has its own object -> NO gas conflicts between different OLTs.
    public entry fun notarize_parallel(
        registry: &OracleRegistry,
        olt_state: &mut OltState,
        new_status: u8,
        time: u64,
        virtual_oracle_id: u64,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let olt_group_id = olt_state.group_id;

        // 1. AUTHORIZATION: sender must have permission for this OLT's group
        let perm_key = OraclePermKey { oracle: sender };
        assert!(df::exists_(&registry.id, perm_key), ENotAuthorized);
        let perms = df::borrow<OraclePermKey, vector<u8>>(&registry.id, perm_key);
        assert!(vector::contains(perms, &olt_group_id), ENotAuthorized);

        // 2. BLOCK REDUNDANT VOTES: if state already reached, abort to save fees/noise
        assert!(olt_state.status != new_status, EStateAlreadyReached);

        // 3. VOTE COLLECTION: manage VoteTable for this specific target status
        if (!df::exists_(&olt_state.id, new_status)) {
            df::add(&mut olt_state.id, new_status, VoteTable {
                voters: vector[virtual_oracle_id],
                target_status: new_status,
            });
        } else {
            let vote_table = df::borrow_mut<u8, VoteTable>(&mut olt_state.id, new_status);
            assert!(!vector::contains(&vote_table.voters, &virtual_oracle_id), EAlreadyVoted);
            vector::push_back(&mut vote_table.voters, virtual_oracle_id);
        };

        // 4. QUORUM CHECK
        let vote_table = df::borrow<u8, VoteTable>(&olt_state.id, new_status);
        let num_votes = vector::length(&vote_table.voters);
        let confirmed = num_votes >= registry.threshold;

        if (confirmed) {
            olt_state.status = new_status;
            olt_state.last_update = time;
            olt_state.last_validator = sender;
            let VoteTable { voters: _, target_status: _ } =
                df::remove<u8, VoteTable>(&mut olt_state.id, new_status);
        };

        // 5. EMIT EVENT
        event::emit(StatusEvent {
            olt_id: olt_state.olt_id,
            status: new_status,
            timestamp: time,
            operator: sender,
            virtual_oracle_id,
            confirmed,
            group_id: olt_group_id,
            last_validator: if (confirmed) sender else olt_state.last_validator,
        });
    }

    // =============================================
    // VIEW FUNCTIONS (read-only)
    // =============================================

    public fun get_olt_group(registry: &OracleRegistry, olt_id: u64): u8 {
        let grp_key = OltGroupKey { olt_id };
        assert!(df::exists_(&registry.id, grp_key), EOltNotFound);
        *df::borrow<OltGroupKey, u8>(&registry.id, grp_key)
    }

    public fun get_olt_object_id(registry: &OracleRegistry, olt_id: u64): ID {
        let disc_key = OltDiscoveryKey { olt_id };
        assert!(df::exists_(&registry.id, disc_key), EOltNotFound);
        *df::borrow<OltDiscoveryKey, ID>(&registry.id, disc_key)
    }
}
