import React, { useState, useMemo, useCallback, useRef, useEffect, createContext, useContext } from "react";

/* ============================== DATA ============================== */
const DAYS_365 = [{"day":1,"id":"365-1","topics":["Node.js Event Loop Phases and libuv Internals","NestJS Architecture: Modules, Providers, DI Container"],"domains":["backend-node","backend-node"]},{"day":2,"id":"365-2","topics":["DynamoDB Internals: Partitioning and Request Routing","React Rendering Model and Reconciliation"],"domains":["databases","frontend"]},{"day":3,"id":"365-3","topics":["TypeScript Advanced Types: Generics, Conditional, Mapped","REST API Design: Resource Modeling and Error Contracts"],"domains":["frontend","systems-eng"]},{"day":4,"id":"365-4","topics":["AWS SQS Deep Dive: Visibility Timeouts, DLQs, FIFO","NestJS Request Lifecycle: Middleware, Guards, Interceptors, Pipes"],"domains":["infra-cloud","backend-node"]},{"day":5,"id":"365-5","topics":["Docker Image Layers, Build Cache, Multi-Stage Builds","Jest Internals: Module Registry, Mocks, Fake Timers"],"domains":["infra-cloud","backend-node"]},{"day":6,"id":"365-6","topics":["AWS Lambda Execution Model and Cold Start Optimization","Elasticsearch Mappings, Analyzers, and Tokenization"],"domains":["infra-cloud","ai-ml"]},{"day":7,"id":"365-7","topics":["Node.js Streams and Backpressure","SNS/SQS Fan-Out and Event-Driven Service Design"],"domains":["backend-node","infra-cloud"]},{"day":8,"id":"365-8","topics":["React Hooks Under the Hood: Fiber, State, Effect Ordering","DynamoDB GSIs and LSIs: Design and Cost Trade-offs"],"domains":["frontend","databases"]},{"day":9,"id":"365-9","topics":["NestJS Microservices: Transporters and Message Patterns","Kubernetes Deployments and Rollout Mechanics"],"domains":["backend-node","infra-cloud"]},{"day":10,"id":"365-10","topics":["Node.js Worker Threads and Cluster Module","AWS EKS Architecture: Control Plane, Node Groups, Fargate"],"domains":["backend-node","infra-cloud"]},{"day":11,"id":"365-11","topics":["Integration Testing NestJS: Supertest and Testcontainers","Elasticsearch Query DSL: Bool Queries and Relevance Scoring"],"domains":["backend-node","databases"]},{"day":12,"id":"365-12","topics":["Express vs Fastify vs NestJS: Performance Models","SNS Message Filtering and Delivery Policies"],"domains":["backend-node","infra-cloud"]},{"day":13,"id":"365-13","topics":["React State Management: Redux Toolkit, Zustand, Jotai","DynamoDB Streams for Event-Driven Patterns"],"domains":["frontend","databases"]},{"day":14,"id":"365-14","topics":["NestJS DTO Validation: class-validator and Serialization","Dockerfile Hardening and Non-Root Containers"],"domains":["backend-node","infra-cloud"]},{"day":15,"id":"365-15","topics":["Node.js Memory Management and V8 Heap Tuning","REST Error Design: Problem Details (RFC 9457)"],"domains":["backend-node","systems-eng"]},{"day":16,"id":"365-16","topics":["Kubernetes Services, Ingress, and Cluster DNS","Elasticsearch Aggregations Deep Dive"],"domains":["infra-cloud","databases"]},{"day":17,"id":"365-17","topics":["OpenAPI-First Development in NestJS","Lambda + SQS Integration: Batching, Partial Failures, Concurrency"],"domains":["backend-node","infra-cloud"]},{"day":18,"id":"365-18","topics":["React Performance: Memoization, Virtualization, Profiler","DynamoDB Transactions and Optimistic Locking"],"domains":["frontend","databases"]},{"day":19,"id":"365-19","topics":["NestJS Exception Filters and Global Error Handling","Kubernetes Probes and Graceful Shutdown Design"],"domains":["backend-node","infra-cloud"]},{"day":20,"id":"365-20","topics":["Node.js Diagnostics: Inspector Protocol, Heap Snapshots, clinic.js","EventBridge vs SNS vs SQS: Choosing AWS Messaging"],"domains":["backend-node","infra-cloud"]},{"day":21,"id":"365-21","topics":["TanStack Query: Caching, Invalidation, Optimistic Updates","Elasticsearch Index Lifecycle Management"],"domains":["perf","databases"]},{"day":22,"id":"365-22","topics":["NestJS CQRS Module and Domain Events","ECR Image Scanning and EKS Deployment Pipelines"],"domains":["frontend","infra-cloud"]},{"day":23,"id":"365-23","topics":["Node.js Observability: pino, OpenTelemetry SDK, Trace Context","DynamoDB Capacity Modes and Cost Engineering"],"domains":["backend-node","databases"]},{"day":24,"id":"365-24","topics":["React Forms at Scale: React Hook Form and Zod","Kubernetes Secrets: Encryption at Rest and External Secrets Operator"],"domains":["frontend","infra-cloud"]},{"day":25,"id":"365-25","topics":["Node.js Child Processes and IPC Patterns","API Rate Limiting and Throttling in NestJS"],"domains":["backend-node","backend-node"]},{"day":26,"id":"365-26","topics":["Frontend Testing: React Testing Library Philosophy","AWS Step Functions for Service Orchestration"],"domains":["frontend","infra-cloud"]},{"day":27,"id":"365-27","topics":["NestJS Authentication: Passport Strategies and Token Rotation","Elasticsearch Relevance Tuning and Function Score"],"domains":["backend-node","databases"]},{"day":28,"id":"365-28","topics":["Vite Bundle Analysis and Code Splitting Strategies","SQS Long Polling, Batching, and Cost Tuning"],"domains":["frontend","infra-cloud"]},{"day":29,"id":"365-29","topics":["Node.js Native Addons: N-API and napi-rs","DynamoDB Hot Partitions: Detection and Mitigation"],"domains":["backend-node","databases"]},{"day":30,"id":"365-30","topics":["Storybook and Component-Driven Development","Container Resource Requests and Limits for Node Workloads"],"domains":["frontend","infra-cloud"]},{"day":31,"id":"365-31","topics":["On-Call Excellence: Runbooks, Triage, Incident Roles","Golden Signals and Service Health Dashboards"],"domains":["systems-eng","systems-eng"]},{"day":32,"id":"365-32","topics":["Raft Consensus Algorithm Deep Dive","React Concurrent Rendering: Transitions and Suspense"],"domains":["distributed-sys","frontend"]},{"day":33,"id":"365-33","topics":["PostgreSQL MVCC and Vacuum Internals","NestJS Background Jobs: BullMQ and Redis Queues"],"domains":["databases","backend-node"]},{"day":34,"id":"365-34","topics":["Kafka Replication Protocol and ISR Mechanics","Node.js HTTP Internals: Agents and Connection Pooling"],"domains":["data-eng","ai-ml"]},{"day":35,"id":"365-35","topics":["OAuth2 Authorization Code Flow with PKCE","Elasticsearch Inverted Index and Segment Merging"],"domains":["security","databases"]},{"day":36,"id":"365-36","topics":["JVM Garbage Collectors: G1, ZGC, Shenandoah","TypeScript Decorators and Reflect Metadata"],"domains":["perf","frontend"]},{"day":37,"id":"365-37","topics":["Retrieval-Augmented Generation Pipeline Design","DynamoDB TTL, Backups, and Global Tables"],"domains":["ai-ml","databases"]},{"day":38,"id":"365-38","topics":["Consistent Hashing and Ring Topologies","Docker Networking: Bridge, Overlay, and Host Modes"],"domains":["distributed-sys","infra-cloud"]},{"day":39,"id":"365-39","topics":["Event Sourcing and Append-Only Log Design","AWS API Gateway: REST vs HTTP APIs and Authorizers"],"domains":["distributed-sys","infra-cloud"]},{"day":40,"id":"365-40","topics":["Kubernetes Scheduler Framework and Plugins","React Error Boundaries and Suspense Data Patterns"],"domains":["infra-cloud","frontend"]},{"day":41,"id":"365-41","topics":["Saga Pattern for Distributed Transactions","Test Doubles Done Right: Fakes, Mocks, Stubs"],"domains":["distributed-sys","systems-eng"]},{"day":42,"id":"365-42","topics":["Envoy Proxy Internals (Service Mesh Data Plane)","Node.js Security: Prototype Pollution and Dependency Risk"],"domains":["infra-cloud","backend-node"]},{"day":43,"id":"365-43","topics":["Flink Checkpointing and Exactly-Once Semantics","Monorepo Tooling for TypeScript: Nx and Turborepo"],"domains":["data-eng","frontend"]},{"day":44,"id":"365-44","topics":["DDD: Aggregates and Bounded Contexts","Search Indexing Pipelines: From CDC to Elasticsearch"],"domains":["systems-eng","databases"]},{"day":45,"id":"365-45","topics":["Change Data Capture with Debezium","WebSockets in NestJS: Gateways and Socket.IO Scaling"],"domains":["data-eng","backend-node"]},{"day":46,"id":"365-46","topics":["eBPF Fundamentals and Production Use Cases","React Router Data APIs and Route-Level Code Splitting"],"domains":["infra-cloud","frontend"]},{"day":47,"id":"365-47","topics":["AWS VPC Networking Deep Dive","IAM for EKS: IRSA and Pod Identity"],"domains":["infra-cloud","infra-cloud"]},{"day":48,"id":"365-48","topics":["GitOps Reconciliation with ArgoCD","Node.js Event Loop Lag: Monitoring and Mitigation"],"domains":["infra-cloud","backend-node"]},{"day":49,"id":"365-49","topics":["mTLS and Certificate Rotation at Scale","DynamoDB DAX and Caching Strategies"],"domains":["security","databases"]},{"day":50,"id":"365-50","topics":["Redis Cluster Sharding and Failover","Structured Outputs and Function Calling Design"],"domains":["databases","systems-eng"]},{"day":51,"id":"365-51","topics":["Model Context Protocol (MCP) Architecture","PostgreSQL Index Types: GIN, GiST, BRIN, Hash"],"domains":["ai-ml","databases"]},{"day":52,"id":"365-52","topics":["OWASP Top 10 with Real Exploit Walkthroughs","Mixture-of-Experts Model Architectures"],"domains":["security","ai-ml"]},{"day":53,"id":"365-53","topics":["JWT Security Pitfalls and Hardening","Contract Testing with Pact for Microservices"],"domains":["security","systems-eng"]},{"day":54,"id":"365-54","topics":["RLHF: Reward Models and PPO","Helm Chart Design and Templating Patterns"],"domains":["ai-ml","infra-cloud"]},{"day":55,"id":"365-55","topics":["LLM Evaluation Frameworks and Benchmarks","Prometheus TSDB Internals"],"domains":["ai-ml","observability"]},{"day":56,"id":"365-56","topics":["Speculative Decoding for LLM Inference","Terraform State Management and Drift Detection"],"domains":["ai-ml","infra-cloud"]},{"day":57,"id":"365-57","topics":["Stream Processing Windowing Semantics","Distributed Tracing with Jaeger and Tempo"],"domains":["data-eng","distributed-sys"]},{"day":58,"id":"365-58","topics":["CQRS in Distributed Systems","SRE Error Budgets and SLO Design"],"domains":["distributed-sys","observability"]},{"day":59,"id":"365-59","topics":["LLM Quantization: GPTQ, AWQ, INT4/INT8","Supply Chain Security: SLSA and Sigstore"],"domains":["ai-ml","security"]},{"day":60,"id":"365-60","topics":["Agentic RAG and Query Decomposition","Linux Page Cache and Direct I/O"],"domains":["ai-ml","infra-cloud"]},{"day":61,"id":"365-61","topics":["Gossip Protocols and Anti-Entropy Repair","Platform Engineering with Backstage"],"domains":["distributed-sys","systems-eng"]},{"day":62,"id":"365-62","topics":["FlashAttention and Memory-Efficient Kernels","PostgreSQL Logical Replication"],"domains":["perf","databases"]},{"day":63,"id":"365-63","topics":["Cell-Based Architecture for Fault Isolation","Load Testing with k6 and Gatling"],"domains":["systems-eng","perf"]},{"day":64,"id":"365-64","topics":["MLOps: Model Registries and Deployment Pipelines","HTTP/2 Multiplexing and HPACK Compression"],"domains":["systems-eng","systems-eng"]},{"day":65,"id":"365-65","topics":["Apache Pulsar vs Kafka: Architectural Trade-offs","OpenID Connect Flows in Depth"],"domains":["data-eng","systems-eng"]},{"day":66,"id":"365-66","topics":["Constitutional AI and RLAIF","Go Garbage Collector Internals"],"domains":["ai-ml","perf"]},{"day":67,"id":"365-67","topics":["Read Replicas and Replication Lag Strategies","Micro-Frontends and Module Federation"],"domains":["distributed-sys","frontend"]},{"day":68,"id":"365-68","topics":["AI Observability: Tracing LLM Pipelines","Cassandra Tombstones and Compaction Strategies"],"domains":["ai-ml","databases"]},{"day":69,"id":"365-69","topics":["Cluster Autoscaler vs Karpenter","Mutation Testing with PIT and Stryker"],"domains":["systems-eng","systems-eng"]},{"day":70,"id":"365-70","topics":["Vision Transformers (ViT) Architecture","gRPC Load Balancing, Retries, and Deadlines"],"domains":["ai-ml","systems-eng"]},{"day":71,"id":"365-71","topics":["Transactional Outbox Pattern","FinOps: Cloud Cost Optimization Engineering"],"domains":["systems-eng","infra-cloud"]},{"day":72,"id":"365-72","topics":["Online Learning and Bandit Algorithms","Redis Persistence: RDB vs AOF Trade-offs"],"domains":["systems-eng","databases"]},{"day":73,"id":"365-73","topics":["Leader Election Patterns and Fencing Tokens","Confidential Computing and Trusted Enclaves"],"domains":["distributed-sys","systems-eng"]},{"day":74,"id":"365-74","topics":["Text-to-SQL System Design","JVM Tuning: Heap Sizing and GC Log Analysis"],"domains":["systems-eng","perf"]},{"day":75,"id":"365-75","topics":["Stream Joins in Flink and Kafka Streams","Secure Code Review Techniques"],"domains":["data-eng","systems-eng"]},{"day":76,"id":"365-76","topics":["Multi-Tenancy Architecture Patterns","V8 Internals: Hidden Classes and Inline Caching"],"domains":["systems-eng","backend-node"]},{"day":77,"id":"365-77","topics":["Bayesian Optimization for Hyperparameters","Service Discovery: Consul, Eureka, DNS-Based"],"domains":["perf","infra-cloud"]},{"day":78,"id":"365-78","topics":["Blue-Green vs Canary vs Shadow Deployments","ClickHouse MergeTree Engine Family"],"domains":["systems-eng","databases"]},{"day":79,"id":"365-79","topics":["LLM Inference Servers: vLLM and TensorRT-LLM","BGP and Internet Routing Fundamentals"],"domains":["ai-ml","systems-eng"]},{"day":80,"id":"365-80","topics":["Data Contracts and Schema Evolution","NestJS Custom Providers and Dynamic Modules"],"domains":["systems-eng","backend-node"]},{"day":81,"id":"365-81","topics":["Idempotency Patterns in Distributed APIs","Datadog APM and Tail-Based Sampling"],"domains":["distributed-sys","observability"]},{"day":82,"id":"365-82","topics":["Speech AI: Whisper and Modern ASR Pipelines","DynamoDB Single-Table Design"],"domains":["ai-ml","databases"]},{"day":83,"id":"365-83","topics":["CRDTs for Collaborative Applications","Kubernetes CSI and Storage Orchestration"],"domains":["distributed-sys","infra-cloud"]},{"day":84,"id":"365-84","topics":["AutoML and Neural Architecture Search","Web Security Headers: CSP, CORS, SameSite"],"domains":["systems-eng","security"]},{"day":85,"id":"365-85","topics":["Dagster Software-Defined Assets","Memory Barriers and CPU Cache Coherence (MESI)"],"domains":["data-eng","perf"]},{"day":86,"id":"365-86","topics":["Small Language Models and Edge Deployment","Connection Pooling Internals (PgBouncer, HikariCP)"],"domains":["systems-eng","systems-eng"]},{"day":87,"id":"365-87","topics":["Distributed Locks: Redlock and Its Critiques","Fine-Grained Reactivity: Signals in Modern Frontends"],"domains":["distributed-sys","frontend"]},{"day":88,"id":"365-88","topics":["Explainability: SHAP and LIME in Production","Nginx Event-Driven Architecture Internals"],"domains":["systems-eng","systems-eng"]},{"day":89,"id":"365-89","topics":["Data Quality Monitoring (Great Expectations)","Threat Modeling with STRIDE and Attack Trees"],"domains":["observability","security"]},{"day":90,"id":"365-90","topics":["Multimodal LLMs: Vision-Language Fusion","Capacity Planning and Queueing Theory"],"domains":["ai-ml","perf"]},{"day":91,"id":"365-91","topics":["Semantic Caching for LLM Applications","etcd Raft Implementation Details"],"domains":["ai-ml","distributed-sys"]},{"day":92,"id":"365-92","topics":["Strangler Fig Pattern for Legacy Migration","Long-Term Metrics Storage: Thanos and Mimir"],"domains":["systems-eng","observability"]},{"day":93,"id":"365-93","topics":["Neo4j Query Planning and Graph Traversal Optimization","Kubernetes Pod Security Standards"],"domains":["databases","infra-cloud"]},{"day":94,"id":"365-94","topics":["Federated Learning Architectures","QUIC 0-RTT and Connection Migration"],"domains":["systems-eng","systems-eng"]},{"day":95,"id":"365-95","topics":["Snowflake: Separation of Storage and Compute","Node.js AsyncLocalStorage and Request Context Propagation"],"domains":["systems-eng","backend-node"]},{"day":96,"id":"365-96","topics":["Red Teaming LLMs and Jailbreak Taxonomies","Consistency Models: Linearizability to Eventual"],"domains":["ai-ml","systems-eng"]},{"day":97,"id":"365-97","topics":["Temporal Workflow Engine Internals","Browser Compositing and the Rendering Pipeline"],"domains":["systems-eng","frontend"]},{"day":98,"id":"365-98","topics":["Two-Tower Models for Recommendations","Workload Orchestrators: Nomad vs Kubernetes"],"domains":["systems-eng","infra-cloud"]},{"day":99,"id":"365-99","topics":["Sharding Strategies: Range, Hash, Directory","OpenTelemetry Collector Pipeline Design"],"domains":["distributed-sys","observability"]},{"day":100,"id":"365-100","topics":["Programmatic Prompt Optimization with DSPy","InnoDB Locking and Isolation Levels"],"domains":["ai-ml","systems-eng"]},{"day":101,"id":"365-101","topics":["Zero-Downtime Database Migration Patterns","WebSockets at Scale: Connection Management"],"domains":["systems-eng","systems-eng"]},{"day":102,"id":"365-102","topics":["Model Serving: Dynamic Batching and Streaming","Topology-Aware Scheduling and Pod Affinity"],"domains":["ai-ml","systems-eng"]},{"day":103,"id":"365-103","topics":["Lambda vs Kappa Architecture","Coverage-Guided Fuzzing (AFL, libFuzzer)"],"domains":["infra-cloud","systems-eng"]},{"day":104,"id":"365-104","topics":["LLM Cost Optimization: Routing and Cascades","TimescaleDB Hypertables and Compression"],"domains":["ai-ml","databases"]},{"day":105,"id":"365-105","topics":["Resilience Budgeting: Timeouts, Retries, Jitter","SBOMs and Dependency Vulnerability Scanning"],"domains":["systems-eng","security"]},{"day":106,"id":"365-106","topics":["Ray: Distributed Python at Scale","HTTP Caching: ETags to stale-while-revalidate"],"domains":["distributed-sys","perf"]},{"day":107,"id":"365-107","topics":["Experimentation Platforms and Sequential Testing","Rust unsafe Code and FFI Boundaries"],"domains":["systems-eng","systems-eng"]},{"day":108,"id":"365-108","topics":["Hybrid Search: BM25 + Dense Retrieval Fusion","Kubernetes Network Policies in Depth"],"domains":["ai-ml","infra-cloud"]},{"day":109,"id":"365-109","topics":["Digital Twin Architectures","Compiler Optimizations: Inlining and Vectorization"],"domains":["systems-eng","ai-ml"]},{"day":110,"id":"365-110","topics":["Data Versioning: lakeFS and DVC","Rate Limiting Algorithms: Token Bucket to Sliding Window"],"domains":["systems-eng","systems-eng"]},{"day":111,"id":"365-111","topics":["Agent Orchestration: LangGraph and CrewAI","PostgreSQL WAL and Crash Recovery"],"domains":["ai-ml","databases"]},{"day":112,"id":"365-112","topics":["Multi-Region Active-Active Design","Modern E2E Testing with Playwright"],"domains":["systems-eng","systems-eng"]},{"day":113,"id":"365-113","topics":["Time Series Anomaly Detection Methods","Envoy xDS Protocol and Dynamic Configuration"],"domains":["systems-eng","infra-cloud"]},{"day":114,"id":"365-114","topics":["Differential Privacy in ML Systems","TypeScript tsconfig Deep Dive and Strictness Migration"],"domains":["security","frontend"]},{"day":115,"id":"365-115","topics":["Batch vs Streaming Ingestion Trade-offs","WebAuthn and Passkeys Architecture"],"domains":["systems-eng","systems-eng"]},{"day":116,"id":"365-116","topics":["GPU Architecture for Deep Learning Workloads","Redis Streams and Consumer Groups"],"domains":["systems-eng","databases"]},{"day":117,"id":"365-117","topics":["Backend-for-Frontend (BFF) Pattern","Chaos Engineering on Kubernetes (LitmusChaos)"],"domains":["frontend","infra-cloud"]},{"day":118,"id":"365-118","topics":["Synthetic Data Generation for ML","ZooKeeper ZAB Protocol Internals"],"domains":["systems-eng","systems-eng"]},{"day":119,"id":"365-119","topics":["Handling Data Skew in Spark","Content Provenance and Signing (C2PA)"],"domains":["data-eng","systems-eng"]},{"day":120,"id":"365-120","topics":["Structured Concurrency Across Languages","Elasticsearch Shard Sizing and Cluster Design"],"domains":["systems-eng","databases"]},{"day":121,"id":"365-121","topics":["LLM Memory Systems: Episodic and Semantic","MySQL Query Optimizer and Join Strategies"],"domains":["ai-ml","databases"]},{"day":122,"id":"365-122","topics":["Quorum Systems and Tunable Consistency","kubelet and Container Runtime Interface Internals"],"domains":["distributed-sys","infra-cloud"]},{"day":123,"id":"365-123","topics":["Fine-Tuning vs RAG: Decision Frameworks","Linux perf and Flame Graph Analysis"],"domains":["ai-ml","infra-cloud"]},{"day":124,"id":"365-124","topics":["Apache Hudi: Copy-on-Write vs Merge-on-Read","API Versioning and Deprecation Strategies"],"domains":["data-eng","systems-eng"]},{"day":125,"id":"365-125","topics":["Knowledge Distillation for LLMs","WireGuard Protocol Internals"],"domains":["ai-ml","systems-eng"]},{"day":126,"id":"365-126","topics":["Event Storming and Collaborative Modeling","ClickHouse Distributed Query Execution"],"domains":["systems-eng","databases"]},{"day":127,"id":"365-127","topics":["Continuous Training Pipelines for ML","Layout Thrashing and Browser Reflow Optimization"],"domains":["systems-eng","frontend"]},{"day":128,"id":"365-128","topics":["Hybrid Cloud Connectivity (Direct Connect, ExpressRoute)","Property Graphs vs RDF Triple Stores"],"domains":["backend-node","systems-eng"]},{"day":129,"id":"365-129","topics":["Safety Classifiers and Layered Content Moderation","Go Channels and Select Statement Internals"],"domains":["systems-eng","systems-eng"]},{"day":130,"id":"365-130","topics":["Materialized Views and Incremental View Maintenance","Penetration Testing Methodology (PTES)"],"domains":["systems-eng","security"]},{"day":131,"id":"365-131","topics":["Voice Agents: ASR\u2013LLM\u2013TTS Latency Engineering","Kafka Tiered Storage Architecture"],"domains":["ai-ml","data-eng"]},{"day":132,"id":"365-132","topics":["Probabilistic Data Structures: Bloom, HLL, Count-Min","CI at Scale: Runners, Caching, Merge Queues"],"domains":["systems-eng","perf"]},{"day":133,"id":"365-133","topics":["Model Drift Detection and Retraining Triggers","PostgreSQL Partitioning Strategies"],"domains":["systems-eng","databases"]},{"day":134,"id":"365-134","topics":["Sandboxed Containers: gVisor and Kata","React Server Components Data Flow"],"domains":["infra-cloud","frontend"]},{"day":135,"id":"365-135","topics":["Prompt Injection Attacks and Defenses","Distributed Rate Limiting Design"],"domains":["ai-ml","distributed-sys"]},{"day":136,"id":"365-136","topics":["Feature Flag Systems at Scale","npm and pnpm Internals: Lockfiles, Hoisting, Workspaces"],"domains":["systems-eng","backend-node"]},{"day":137,"id":"365-137","topics":["GraphRAG: Knowledge Graphs Meet LLMs","NUMA Awareness and CPU Pinning"],"domains":["ai-ml","systems-eng"]},{"day":138,"id":"365-138","topics":["Data Lineage and Catalog Systems (OpenLineage, DataHub)","OAuth2 Token Exchange and Delegation"],"domains":["systems-eng","security"]},{"day":139,"id":"365-139","topics":["Reactive Streams and Project Reactor","S3 Internals: Consistency and Performance Patterns"],"domains":["frontend","perf"]},{"day":140,"id":"365-140","topics":["Evaluation-Driven Development for AI Products","Cassandra Repair, Hints, and Read Repair"],"domains":["systems-eng","databases"]},{"day":141,"id":"365-141","topics":["Sidecar-less Mesh: Cilium and eBPF Networking","TypeScript Type System: Conditional and Mapped Types"],"domains":["infra-cloud","frontend"]},{"day":142,"id":"365-142","topics":["Long-Context LLMs: RoPE Scaling, Attention Sinks","L4 vs L7 Load Balancing Algorithms"],"domains":["ai-ml","systems-eng"]},{"day":143,"id":"365-143","topics":["Replication Topologies: Chain, Star, Mesh","Trunk-Based Development and CI Discipline"],"domains":["distributed-sys","systems-eng"]},{"day":144,"id":"365-144","topics":["TinyML and On-Device Inference","Prometheus Recording Rules and Alert Design"],"domains":["systems-eng","observability"]},{"day":145,"id":"365-145","topics":["Search Infrastructure: Vespa vs Elasticsearch","Rust Traits and Zero-Cost Abstractions"],"domains":["databases","systems-eng"]},{"day":146,"id":"365-146","topics":["Temporal vs Airflow vs Step Functions","Container Image Optimization and Distroless Builds"],"domains":["data-eng","infra-cloud"]},{"day":147,"id":"365-147","topics":["Preference Optimization: DPO, KTO, ORPO","Clock Synchronization: NTP, PTP, and Skew"],"domains":["ai-ml","systems-eng"]},{"day":148,"id":"365-148","topics":["Streaming SQL Engines: Materialize, RisingWave","Least-Privilege Design and Permission Boundaries"],"domains":["systems-eng","systems-eng"]},{"day":149,"id":"365-149","topics":["gRPC vs REST vs GraphQL: API Trade-off Analysis","Write-Ahead Logging Across Database Engines"],"domains":["systems-eng","observability"]},{"day":150,"id":"365-150","topics":["Robotics Software Stacks and ROS 2","Accessibility Engineering (WCAG 2.2)"],"domains":["systems-eng","frontend"]},{"day":151,"id":"365-151","topics":["Failure Detectors: Phi Accrual and Heartbeats","Snowflake Clustering Keys and Query Pruning"],"domains":["systems-eng","systems-eng"]},{"day":152,"id":"365-152","topics":["Code Generation LLMs: Training and Evaluation","Istio Control Plane (istiod) Internals"],"domains":["ai-ml","infra-cloud"]},{"day":153,"id":"365-153","topics":["Deterministic Simulation Testing (FoundationDB Style)","Python GIL and Free-Threaded CPython"],"domains":["systems-eng","systems-eng"]},{"day":154,"id":"365-154","topics":["Data Mesh Federated Computational Governance","KMS Envelope Encryption and HSMs"],"domains":["data-eng","security"]},{"day":155,"id":"365-155","topics":["Vector Search at Scale: Sharding and Filtered ANN","Autoscaling: HPA, VPA, and KEDA"],"domains":["ai-ml","systems-eng"]},{"day":156,"id":"365-156","topics":["Bun and Deno: Alternative JavaScript Runtimes","Parquet and ORC File Format Internals"],"domains":["systems-eng","data-eng"]},{"day":157,"id":"365-157","topics":["Multi-Armed Bandits for Experimentation","Edge Compute: Cloudflare Workers, Lambda@Edge"],"domains":["systems-eng","infra-cloud"]},{"day":158,"id":"365-158","topics":["Continuous Batching and PagedAttention","Connection Storms and Backpressure at the Database"],"domains":["systems-eng","systems-eng"]},{"day":159,"id":"365-159","topics":["Delivery Semantics: At-Least-Once vs Exactly-Once","SAST vs DAST vs IAST Trade-offs"],"domains":["systems-eng","security"]},{"day":160,"id":"365-160","topics":["Time Travel and Snapshot Isolation in Lakehouses","C++ Atomics and Memory Ordering"],"domains":["data-eng","perf"]},{"day":161,"id":"365-161","topics":["AI-Assisted Code Review Systems","Consistent Snapshots in Distributed Databases"],"domains":["systems-eng","distributed-sys"]},{"day":162,"id":"365-162","topics":["Serverless Event Processing (Kinesis, EventBridge)","Real User Monitoring and Frontend Error Tracking"],"domains":["infra-cloud","frontend"]},{"day":163,"id":"365-163","topics":["Reward Hacking and Specification Gaming","MongoDB Sharding and Balancer Internals"],"domains":["ai-ml","databases"]},{"day":164,"id":"365-164","topics":["Cache Invalidation Strategies at Scale","Kubernetes Descheduler and Bin-Packing Efficiency"],"domains":["perf","infra-cloud"]},{"day":165,"id":"365-165","topics":["Neural Vocoders and Modern TTS","Post-Quantum Cryptography Migration"],"domains":["systems-eng","systems-eng"]},{"day":166,"id":"365-166","topics":["Flink State Backends and RocksDB Tuning","AWS SDK for JavaScript v3: Middleware and Retry Internals"],"domains":["databases","infra-cloud"]},{"day":167,"id":"365-167","topics":["Distributed Fine-Tuning: FSDP and DeepSpeed ZeRO","HTTP Request Smuggling and Desync Attacks"],"domains":["ai-ml","systems-eng"]},{"day":168,"id":"365-168","topics":["Schema Registries and Compatibility Modes","Python Profiling: py-spy, cProfile, Scalene"],"domains":["systems-eng","observability"]},{"day":169,"id":"365-169","topics":["AI Accelerators: TPUs, Inferentia, Custom Silicon","Saga Compensation Logic Design"],"domains":["systems-eng","distributed-sys"]},{"day":170,"id":"365-170","topics":["Data Observability: Freshness, Volume, Distribution","WebGPU and Compute Shaders"],"domains":["observability","frontend"]},{"day":171,"id":"365-171","topics":["Agent Sandboxing and Tool Permissioning","PostgreSQL Bloat Management and Vacuum Tuning"],"domains":["ai-ml","databases"]},{"day":172,"id":"365-172","topics":["Edge AI Deployment Pipelines","Coordination Without ZooKeeper: Modern Patterns"],"domains":["systems-eng","systems-eng"]},{"day":173,"id":"365-173","topics":["Retrieval Metrics: NDCG, MRR, Recall@K","Terraform Module Design and Workspace Strategy"],"domains":["ai-ml","infra-cloud"]},{"day":174,"id":"365-174","topics":["Batch Scheduling: YARN to Kubernetes (Volcano, Kueue)","Rust Error Handling Philosophy and thiserror/anyhow"],"domains":["infra-cloud","systems-eng"]},{"day":175,"id":"365-175","topics":["Model Cards and AI System Documentation","Personalization and Caching in BFF Layers"],"domains":["systems-eng","perf"]},{"day":176,"id":"365-176","topics":["Real-Time OLAP: Apache Pinot and Druid","Runtime Security: Falco, Seccomp, AppArmor"],"domains":["systems-eng","security"]},{"day":177,"id":"365-177","topics":["Data Mixing and Curriculum for LLM Pretraining","DNS Failover and Health-Checked Routing"],"domains":["ai-ml","infra-cloud"]},{"day":178,"id":"365-178","topics":["Idempotent Consumers and Deduplication","V8 Garbage Collection: Orinoco, Scavenger, Marking"],"domains":["systems-eng","backend-node"]},{"day":179,"id":"365-179","topics":["Privacy Engineering: Data Minimization Patterns","Flink SQL and Dynamic Tables"],"domains":["security","data-eng"]},{"day":180,"id":"365-180","topics":["ML Compilers: XLA, Triton, and Kernel Fusion","API Gateway Authentication Patterns"],"domains":["systems-eng","infra-cloud"]},{"day":181,"id":"365-181","topics":["Designing Chaos Experiments and Blast Radius","ClickHouse Materialized Views and Projections"],"domains":["systems-eng","databases"]},{"day":182,"id":"365-182","topics":["Agentic Coding: Repo-Scale Context Strategies","CockroachDB Distributed SQL Internals"],"domains":["ai-ml","databases"]},{"day":183,"id":"365-183","topics":["Session Guarantees: Read-Your-Writes, Monotonic Reads","Kubernetes Gateway API Deep Dive"],"domains":["systems-eng","infra-cloud"]},{"day":184,"id":"365-184","topics":["Diffusion Transformers and Video Generation","JVM GC Tuning Case Studies from Production"],"domains":["ai-ml","perf"]},{"day":185,"id":"365-185","topics":["Zero-ETL and Federated Query Architectures","OWASP API Security Top 10"],"domains":["data-eng","security"]},{"day":186,"id":"365-186","topics":["Cost-Based Query Optimization Theory","Metrics Design: Cardinality and Micrometer"],"domains":["perf","observability"]},{"day":187,"id":"365-187","topics":["Long-Running Agent Reliability Patterns","TCP Tuning: Nagle, Delayed ACK, Fast Open"],"domains":["ai-ml","perf"]},{"day":188,"id":"365-188","topics":["Open Table Sharing: Delta Sharing, Iceberg REST Catalog","Frontend Build Tooling Internals: Vite, Turbopack"],"domains":["data-eng","frontend"]},{"day":189,"id":"365-189","topics":["Simulation Environments for Reinforcement Learning","Redis as a Vector Store: Capabilities and Limits"],"domains":["systems-eng","ai-ml"]},{"day":190,"id":"365-190","topics":["TLA+ and Formal Specification of Distributed Systems","Workload Identity Federation (SPIFFE/SPIRE)"],"domains":["distributed-sys","systems-eng"]},{"day":191,"id":"365-191","topics":["Streaming Feature Computation for Real-Time ML","Architecture Documentation with the C4 Model"],"domains":["systems-eng","systems-eng"]},{"day":192,"id":"365-192","topics":["Test-Time Compute and Reasoning Models","Envoy WASM Filters and Extensibility"],"domains":["ai-ml","frontend"]},{"day":193,"id":"365-193","topics":["Geo-Partitioning and Data Residency Engineering","SolidJS and Fine-Grained Reactive Rendering"],"domains":["systems-eng","frontend"]},{"day":194,"id":"365-194","topics":["Feature Attribution Under Distribution Shift","HAProxy Internals and Connection Handling"],"domains":["systems-eng","systems-eng"]},{"day":195,"id":"365-195","topics":["Hierarchical Agents and Task Decomposition","FoundationDB Layered Architecture"],"domains":["ai-ml","systems-eng"]},{"day":196,"id":"365-196","topics":["Compaction Strategies: Leveled vs Tiered LSM","Software Composition Analysis in CI"],"domains":["databases","systems-eng"]},{"day":197,"id":"365-197","topics":["Speech-to-Speech Models and Full-Duplex Audio","AWS Lambda Internals: Firecracker MicroVMs"],"domains":["systems-eng","infra-cloud"]},{"day":198,"id":"365-198","topics":["Hinted Handoff and Sloppy Quorums","Design Tokens and Scalable Design Systems"],"domains":["distributed-sys","frontend"]},{"day":199,"id":"365-199","topics":["GPU Cluster Scheduling and Gang Scheduling","Postgres Extensions Ecosystem: pgvector, Citus, TimescaleDB"],"domains":["systems-eng","databases"]},{"day":200,"id":"365-200","topics":["AI Red Teaming Automation","Content-Addressable Storage and Merkle Trees"],"domains":["systems-eng","systems-eng"]},{"day":201,"id":"365-201","topics":["Weak Supervision and Programmatic Labeling","NATS and Lightweight Messaging Architectures"],"domains":["systems-eng","systems-eng"]},{"day":202,"id":"365-202","topics":["Split-Brain Scenarios and Fencing Strategies","React Native New Architecture: Fabric and JSI"],"domains":["systems-eng","frontend"]},{"day":203,"id":"365-203","topics":["Recommendation Retrieval-Ranking-Reranking Stacks","Kubernetes Cluster API and Fleet Management"],"domains":["ai-ml","infra-cloud"]},{"day":204,"id":"365-204","topics":["Human-in-the-Loop Pipelines for AI Systems","ClickHouse vs Druid vs Pinot: OLAP Selection"],"domains":["systems-eng","databases"]},{"day":205,"id":"365-205","topics":["Distributed Snapshot Algorithms (Chandy-Lamport)","OAuth2 for Machine-to-Machine (Client Credentials, DPoP)"],"domains":["distributed-sys","ai-ml"]},{"day":206,"id":"365-206","topics":["Streaming Data Deduplication at Scale","CSS Container Queries and Modern Layout Engines"],"domains":["systems-eng","frontend"]},{"day":207,"id":"365-207","topics":["Mixture-of-Depths and Conditional Computation","Linux OOM Killer and Memory Pressure (PSI)"],"domains":["ai-ml","infra-cloud"]},{"day":208,"id":"365-208","topics":["Reverse ETL and Operational Analytics","Fault Injection at the Network Layer (tc, Toxiproxy)"],"domains":["data-eng","systems-eng"]},{"day":209,"id":"365-209","topics":["Multi-Objective Ranking and Calibration","Git Internals: Objects, Packfiles, and Delta Compression"],"domains":["systems-eng","systems-eng"]},{"day":210,"id":"365-210","topics":["Privacy-Preserving Analytics: k-Anonymity to DP-SQL","Service Level Objective Math: Burn Rates"],"domains":["security","systems-eng"]},{"day":211,"id":"365-211","topics":["LLM Routing and Model Cascades in Production","B-Tree vs LSM-Tree: Choosing Storage Engines"],"domains":["ai-ml","databases"]},{"day":212,"id":"365-212","topics":["Retrieval Index Freshness and Incremental Updates","Zero-Copy Techniques: sendfile, mmap, splice"],"domains":["ai-ml","systems-eng"]},{"day":213,"id":"365-213","topics":["World Models and Model-Based RL","Vitess: Scaling MySQL Horizontally"],"domains":["ai-ml","frontend"]},{"day":214,"id":"365-214","topics":["Bulk Synchronous Parallel and Graph Processing (Pregel)","SLSA Levels and Build Provenance"],"domains":["systems-eng","systems-eng"]},{"day":215,"id":"365-215","topics":["Grounding and Hallucination Mitigation Techniques","Kubernetes CRD Design and API Conventions"],"domains":["ai-ml","infra-cloud"]},{"day":216,"id":"365-216","topics":["Exactly-Once Sinks: Idempotent vs Transactional Writes","Rust Procedural Macros"],"domains":["systems-eng","systems-eng"]},{"day":217,"id":"365-217","topics":["Contrastive Learning and Embedding Training","HTTP Connection Pooling and Keep-Alive Tuning"],"domains":["ai-ml","perf"]},{"day":218,"id":"365-218","topics":["Backfill Strategies for Large Data Pipelines","Session Management and Token Rotation Security"],"domains":["systems-eng","security"]},{"day":219,"id":"365-219","topics":["Sparse Attention Variants and Linear Attention","MySQL Group Replication and Galera"],"domains":["ai-ml","databases"]},{"day":220,"id":"365-220","topics":["Actor Model: Akka, Orleans, and Erlang/OTP","Progressive Web Apps and Service Worker Caching"],"domains":["systems-eng","perf"]},{"day":221,"id":"365-221","topics":["ML Feature Selection at Scale","Argo Workflows for Data and ML Pipelines"],"domains":["systems-eng","systems-eng"]},{"day":222,"id":"365-222","topics":["Read/Write Amplification in Storage Engines","API Idempotency Keys and Safe Retries"],"domains":["systems-eng","systems-eng"]},{"day":223,"id":"365-223","topics":["Retrieval-Augmented Code Generation","Netty and JVM Async Networking"],"domains":["ai-ml","systems-eng"]},{"day":224,"id":"365-224","topics":["Event Replay and Rebuilding State from Logs","Cloud Egress Costs and Network Architecture"],"domains":["systems-eng","infra-cloud"]},{"day":225,"id":"365-225","topics":["Uplift Modeling and Heterogeneous Treatment Effects","Debugging Distributed Systems: Correlation and Causality"],"domains":["systems-eng","distributed-sys"]},{"day":226,"id":"365-226","topics":["Prompt Caching and Prefix Sharing Economics","SQLite Internals and Embedded Database Design"],"domains":["ai-ml","databases"]},{"day":227,"id":"365-227","topics":["Priority Queues and Fair Scheduling in Multi-Tenant Systems","WebRTC Architecture and Media Servers"],"domains":["systems-eng","frontend"]},{"day":228,"id":"365-228","topics":["Data Augmentation Strategies Across Modalities","GitOps Progressive Delivery with Argo Rollouts"],"domains":["systems-eng","infra-cloud"]},{"day":229,"id":"365-229","topics":["Log-Structured Merge Trees: Bloom and Fence Pointers","Browser Sandboxing and Site Isolation"],"domains":["systems-eng","frontend"]},{"day":230,"id":"365-230","topics":["Multi-Agent Communication Protocols (A2A)","PostgreSQL Statistics and Selectivity Estimation"],"domains":["ai-ml","databases"]},{"day":231,"id":"365-231","topics":["Streaming Windows: Watermarks and Late Data","Memory Safety: ASAN, MIRI, and Sanitizers"],"domains":["systems-eng","perf"]},{"day":232,"id":"365-232","topics":["Model Merging and Weight Averaging (SLERP, TIES)","Squid/Varnish and Reverse Proxy Caching"],"domains":["systems-eng","perf"]},{"day":233,"id":"365-233","topics":["Failure Modes of Microservices: Retry Storms, Cascades","DuckDB Vectorized Execution Internals"],"domains":["systems-eng","ai-ml"]},{"day":234,"id":"365-234","topics":["Active Learning and Data-Centric AI","Kubernetes Multi-Cluster Networking (Submariner, Skupper)"],"domains":["systems-eng","infra-cloud"]},{"day":235,"id":"365-235","topics":["Consensus in Practice: etcd vs Consul vs ZooKeeper","Frontend Hydration Strategies: Islands, Resumability"],"domains":["distributed-sys","frontend"]},{"day":236,"id":"365-236","topics":["AI Inference at the Edge: ONNX Runtime, CoreML","Row-Level Security and Fine-Grained AuthZ"],"domains":["systems-eng","security"]},{"day":237,"id":"365-237","topics":["Query Federation: Trino Connectors and Pushdown","Go Memory Model and Data Race Detection"],"domains":["systems-eng","perf"]},{"day":238,"id":"365-238","topics":["Vector Database Selection: pgvector, Qdrant, Milvus, Pinecone","Distributed Cron and Job Scheduling Reliability"],"domains":["ai-ml","distributed-sys"]},{"day":239,"id":"365-239","topics":["Position Interpolation and Context Extension Methods","Packet Capture Analysis with tcpdump and Wireshark"],"domains":["systems-eng","systems-eng"]},{"day":240,"id":"365-240","topics":["Data Clean Rooms and Secure Multi-Party Computation","Java Native Memory Tracking and Off-Heap Memory"],"domains":["systems-eng","perf"]},{"day":241,"id":"365-241","topics":["Speculative Execution in Query Engines","OpenFeature and Vendor-Neutral Flag Standards"],"domains":["systems-eng","systems-eng"]},{"day":242,"id":"365-242","topics":["Reinforcement Fine-Tuning for Tool Use","Cassandra vs ScyllaDB vs DynamoDB Selection"],"domains":["ai-ml","databases"]},{"day":243,"id":"365-243","topics":["Cold Start Problem in Recommendations","eBPF-Based Observability (Pixie, Parca)"],"domains":["systems-eng","infra-cloud"]},{"day":244,"id":"365-244","topics":["LLM-as-Judge: Reliability and Bias Correction","Kernel Bypass Networking: DPDK and XDP"],"domains":["ai-ml","systems-eng"]},{"day":245,"id":"365-245","topics":["Ports-and-Adapters Testing Strategy","Iceberg Partition Evolution and Hidden Partitioning"],"domains":["systems-eng","data-eng"]},{"day":246,"id":"365-246","topics":["Neural Ranking Models: Cross-Encoders","Kubernetes Audit Logging and Forensics"],"domains":["ai-ml","infra-cloud"]},{"day":247,"id":"365-247","topics":["Message Ordering Guarantees Across Partitions","WASM on the Server: Component Model and WASI"],"domains":["systems-eng","frontend"]},{"day":248,"id":"365-248","topics":["GANs vs Diffusion vs Autoregressive Image Models","PostgreSQL HOT Updates and Fill Factor"],"domains":["ai-ml","databases"]},{"day":249,"id":"365-249","topics":["Dependency Inversion in Large Codebases","gRPC-Web and Browser Streaming Constraints"],"domains":["systems-eng","frontend"]},{"day":250,"id":"365-250","topics":["Feature Store Online/Offline Consistency","Detection Engineering and SIEM Pipelines"],"domains":["systems-eng","systems-eng"]},{"day":251,"id":"365-251","topics":["Autoregressive Decoding: Sampling Strategies","Compaction and GC in Kafka Log Segments"],"domains":["systems-eng","data-eng"]},{"day":252,"id":"365-252","topics":["Bounded Staleness and Client-Centric Consistency","Profile-Guided Optimization (PGO)"],"domains":["systems-eng","perf"]},{"day":253,"id":"365-253","topics":["Embedding Drift and Index Rebuilding Strategies","Terraform vs Pulumi vs CDK: IaC Architecture"],"domains":["ai-ml","infra-cloud"]},{"day":254,"id":"365-254","topics":["Counterfactual Evaluation of Ranking Systems","HTTP/2 Rapid Reset and Protocol-Level DDoS"],"domains":["systems-eng","systems-eng"]},{"day":255,"id":"365-255","topics":["Durable Execution Semantics (Temporal, Restate)","Arrow and Zero-Copy Data Interchange"],"domains":["systems-eng","systems-eng"]},{"day":256,"id":"365-256","topics":["Guardrails for Autonomous Agents in Production","MySQL Binlog Formats and Replication Filtering"],"domains":["ai-ml","databases"]},{"day":257,"id":"365-257","topics":["Modular Monoliths as a Microservices Alternative","Web Workers, SharedArrayBuffer, and Atomics"],"domains":["systems-eng","frontend"]},{"day":258,"id":"365-258","topics":["GPU Memory Optimization: Activation Checkpointing","Blast-Radius-Aware IAM Design"],"domains":["perf","infra-cloud"]},{"day":259,"id":"365-259","topics":["Sessionization and Funnel Analytics at Scale","JIT vs AOT Across Runtimes"],"domains":["systems-eng","systems-eng"]},{"day":260,"id":"365-260","topics":["Adversarial Robustness in ML Models","Load Shedding and Priority-Based Degradation"],"domains":["systems-eng","systems-eng"]},{"day":261,"id":"365-261","topics":["Semantic Layer Architectures (dbt, Cube)","Linux Scheduler: CFS to EEVDF"],"domains":["systems-eng","infra-cloud"]},{"day":262,"id":"365-262","topics":["Tokenizers: BPE, SentencePiece, and Their Failure Modes","CDC Pipeline Reliability: Snapshots and Resume"],"domains":["ai-ml","data-eng"]},{"day":263,"id":"365-263","topics":["Byzantine Fault Tolerance and PBFT","Design Review Culture and RFC Processes"],"domains":["distributed-sys","systems-eng"]},{"day":264,"id":"365-264","topics":["Reinforcement Learning from Execution Feedback","Redis Latency Analysis and Slowlog Forensics"],"domains":["systems-eng","databases"]},{"day":265,"id":"365-265","topics":["Data Skipping: Zone Maps and Min-Max Indexes","Supply Chain Attacks: Typosquatting to Build Injection"],"domains":["systems-eng","security"]},{"day":266,"id":"365-266","topics":["Interoperable Agent Standards: MCP vs Function Calling","Erlang BEAM VM and Fault-Tolerant Design"],"domains":["ai-ml","systems-eng"]},{"day":267,"id":"365-267","topics":["Monorepo Build Systems: Bazel and Buck2","Query Result Caching Layers and Consistency"],"domains":["systems-eng","perf"]},{"day":268,"id":"365-268","topics":["Video Understanding Models","Kubernetes Node Lifecycle: Taints, Cordons, Drains"],"domains":["systems-eng","infra-cloud"]},{"day":269,"id":"365-269","topics":["Write Skew and Serializable Isolation Anomalies","Real-Time Collaboration Engines (OT vs CRDT)"],"domains":["systems-eng","distributed-sys"]},{"day":270,"id":"365-270","topics":["ML Serving Meshes and Model Routing","DNS Caching Layers and Negative Caching"],"domains":["systems-eng","infra-cloud"]},{"day":271,"id":"365-271","topics":["Petabyte-Scale Shuffle: Spark AQE and Remote Shuffle","Secure Defaults and Paved-Road Platform Design"],"domains":["data-eng","systems-eng"]},{"day":272,"id":"365-272","topics":["Alignment Techniques Overview: From SFT to Deliberative Methods","Time-Series Compression: Gorilla and Delta-of-Delta"],"domains":["systems-eng","systems-eng"]},{"day":273,"id":"365-273","topics":["Search Query Understanding and Spell Correction","Container Escape Vectors and Hardening"],"domains":["systems-eng","ai-ml"]},{"day":274,"id":"365-274","topics":["Inference-Time Scaling Laws","TiDB and HTAP Database Architecture"],"domains":["systems-eng","databases"]},{"day":275,"id":"365-275","topics":["Event-Carried State Transfer vs Event Notification","Rust Pin, Unpin, and Self-Referential Futures"],"domains":["systems-eng","systems-eng"]},{"day":276,"id":"365-276","topics":["Multi-Vector Retrieval: ColBERT and Late Interaction","Cloud Spanner and TrueTime"],"domains":["ai-ml","databases"]},{"day":277,"id":"365-277","topics":["Dead Letter Queues and Poison Message Handling","Frontend Performance Budgets and CI Enforcement"],"domains":["systems-eng","frontend"]},{"day":278,"id":"365-278","topics":["Mixture Routing and Expert Load Balancing","PostgreSQL Foreign Data Wrappers"],"domains":["systems-eng","databases"]},{"day":279,"id":"365-279","topics":["Domain Events vs Integration Events in DDD","Homomorphic Encryption: Practical State of the Art"],"domains":["frontend","security"]},{"day":280,"id":"365-280","topics":["Physics-Informed Neural Networks","HTTP/1.1 Head-of-Line Blocking Through HTTP/3"],"domains":["systems-eng","systems-eng"]},{"day":281,"id":"365-281","topics":["Data Product Thinking and SLAs for Datasets","Node.js in Containers: Memory Limits and Heap Sizing"],"domains":["systems-eng","backend-node"]},{"day":282,"id":"365-282","topics":["Agent Evaluation: Trajectory-Level Metrics","Global Secondary Indexes: Design and Consistency Costs"],"domains":["ai-ml","systems-eng"]},{"day":283,"id":"365-283","topics":["ACID Revisited: H\u00e4rder-Reuter to Modern Interpretations","Streaming Media Delivery: HLS, DASH, CMAF"],"domains":["systems-eng","systems-eng"]},{"day":284,"id":"365-284","topics":["Sparse Retrieval Renaissance: SPLADE","Kubernetes Informers and Client-Go Patterns"],"domains":["ai-ml","infra-cloud"]},{"day":285,"id":"365-285","topics":["Compile-Time Metaprogramming: Zig comptime, C++ Templates","Payment Systems Engineering: Idempotency and Ledgers"],"domains":["systems-eng","systems-eng"]},{"day":286,"id":"365-286","topics":["Reasoning Distillation into Smaller Models","ClickHouse ReplacingMergeTree and Deduplication"],"domains":["ai-ml","databases"]},{"day":287,"id":"365-287","topics":["Failure Recovery: Checkpoint-Restore (CRIU)","GraphQL Federation and Schema Composition"],"domains":["systems-eng","systems-eng"]},{"day":288,"id":"365-288","topics":["Simulation-Based Load Modeling","Certificate Transparency and PKI Internals"],"domains":["systems-eng","security"]},{"day":289,"id":"365-289","topics":["Multimodal Embeddings and Cross-Modal Retrieval","Go Escape Analysis and pprof Workflows"],"domains":["ai-ml","systems-eng"]},{"day":290,"id":"365-290","topics":["Distributed Transactions Without 2PC: Percolator Model","Feature Toggle Debt and Cleanup Automation"],"domains":["distributed-sys","systems-eng"]},{"day":291,"id":"365-291","topics":["AI Governance: EU AI Act Engineering Implications","Cache Stampede Protection: Locks, Probabilistic Expiry"],"domains":["security","perf"]},{"day":292,"id":"365-292","topics":["Learned Indexes and ML for Systems","SMTP, DKIM, SPF, DMARC: Email Infrastructure"],"domains":["systems-eng","systems-eng"]},{"day":293,"id":"365-293","topics":["Chaos Engineering Maturity: GameDays and Continuous Verification","Delta Live Tables and Declarative Pipelines"],"domains":["systems-eng","systems-eng"]},{"day":294,"id":"365-294","topics":["Structured State Space Models (Mamba)","Row vs Column Locking Behavior Across Engines"],"domains":["systems-eng","systems-eng"]},{"day":295,"id":"365-295","topics":["Backward-Compatible API Evolution in gRPC/Protobuf","Browser Fingerprinting and Bot Detection"],"domains":["systems-eng","frontend"]},{"day":296,"id":"365-296","topics":["Online Model Updating: Shadow and Interleaved Serving","Kubernetes Priority Classes and Preemption"],"domains":["systems-eng","infra-cloud"]},{"day":297,"id":"365-297","topics":["Data Contracts Enforcement in CI/CD","io_uring for Network Servers"],"domains":["systems-eng","systems-eng"]},{"day":298,"id":"365-298","topics":["Constitutional Design of Autonomous Systems","Sharded Counters and Hot Key Mitigation"],"domains":["systems-eng","systems-eng"]},{"day":299,"id":"365-299","topics":["Speech Diarization and Multi-Speaker ASR","OCSP, CRLs, and Certificate Revocation Reality"],"domains":["systems-eng","security"]},{"day":300,"id":"365-300","topics":["Warehouse-Native Activation and Composable CDPs","Trace Context Across SQS/SNS Hops: Event Correlation"],"domains":["systems-eng","infra-cloud"]},{"day":301,"id":"365-301","topics":["Robustness Testing for ML: Metamorphic Testing","Multipath TCP and QUIC Multipath"],"domains":["systems-eng","systems-eng"]},{"day":302,"id":"365-302","topics":["Human Preference Data Collection Pipelines","Storage Tiering: NVMe, SSD, Object Storage Economics"],"domains":["systems-eng","systems-eng"]},{"day":303,"id":"365-303","topics":["Anti-Corruption Layers in Integration Design","WebTransport and Next-Gen Browser Networking"],"domains":["systems-eng","frontend"]},{"day":304,"id":"365-304","topics":["Quantum Computing: Algorithms Engineers Should Know","Vault Dynamic Secrets and PKI Engine"],"domains":["systems-eng","security"]},{"day":305,"id":"365-305","topics":["Agent Memory Compaction and Context Management","InfluxDB and Time-Series Storage Engines"],"domains":["ai-ml","databases"]},{"day":306,"id":"365-306","topics":["Split-Phase Commit: Preparing for Regional Failover","ESM, CommonJS, and JavaScript Module Resolution"],"domains":["systems-eng","systems-eng"]},{"day":307,"id":"365-307","topics":["Neural Information Retrieval End-to-End","Kubernetes Sidecar Containers and Init Ordering"],"domains":["ai-ml","infra-cloud"]},{"day":308,"id":"365-308","topics":["Data Skew in Joins: Salting and Broadcast Strategies","Rust Send/Sync and Fearless Concurrency"],"domains":["systems-eng","systems-eng"]},{"day":309,"id":"365-309","topics":["Watermarking AI-Generated Content","MySQL Adaptive Hash Index and Change Buffer"],"domains":["systems-eng","databases"]},{"day":310,"id":"365-310","topics":["Bulk Data Movement: DistCp to Cloud-Native Transfer","Passwordless Enterprise Auth Architecture"],"domains":["infra-cloud","systems-eng"]},{"day":311,"id":"365-311","topics":["Continual Learning and Catastrophic Forgetting","HTTP Client Resilience: Hedging and Timeout Budgets"],"domains":["systems-eng","systems-eng"]},{"day":312,"id":"365-312","topics":["Read-Optimized vs Write-Optimized System Design","Design Systems Governance at Scale"],"domains":["systems-eng","frontend"]},{"day":313,"id":"365-313","topics":["Retrieval for Long-Horizon Agents","Linux Networking Stack: NAPI, GRO, RSS"],"domains":["ai-ml","infra-cloud"]},{"day":314,"id":"365-314","topics":["Causal ML in Production Decision Systems","Argo CD ApplicationSets and Multi-Env Promotion"],"domains":["systems-eng","systems-eng"]},{"day":315,"id":"365-315","topics":["Hot/Warm/Cold Path Architectures","SQL Injection Beyond Basics: Second-Order and ORM Pitfalls"],"domains":["systems-eng","systems-eng"]},{"day":316,"id":"365-316","topics":["Sparse Fine-Tuning and Adapter Fusion","ClickHouse Kafka Engine and Streaming Ingestion"],"domains":["ai-ml","databases"]},{"day":317,"id":"365-317","topics":["Bulkhead Isolation in Thread Pools and Connection Pools","Frontend Security: XSS Sinks and Trusted Types"],"domains":["systems-eng","frontend"]},{"day":318,"id":"365-318","topics":["Reward Model Overoptimization (Goodhart Effects)","Consistent Prefix Reads in Replicated Systems"],"domains":["ai-ml","systems-eng"]},{"day":319,"id":"365-319","topics":["Data Warehouse Cost Attribution and Chargeback","Node.js Crash Diagnostics: Core Dumps and llnode"],"domains":["systems-eng","backend-node"]},{"day":320,"id":"365-320","topics":["Egocentric and Spatial AI for AR/Robotics","Service Catalogs and Golden Paths in IDPs"],"domains":["systems-eng","systems-eng"]},{"day":321,"id":"365-321","topics":["Streaming Aggregation Accuracy vs Latency Trade-offs","Memory Allocators: jemalloc, tcmalloc, mimalloc"],"domains":["systems-eng","perf"]},{"day":322,"id":"365-322","topics":["Model Inversion and Membership Inference Attacks","Distributed Sagas vs Workflow Engines: When to Choose"],"domains":["systems-eng","distributed-sys"]},{"day":323,"id":"365-323","topics":["Search Personalization Without Filter Bubbles","Kubernetes Resource QoS Classes and Eviction"],"domains":["systems-eng","infra-cloud"]},{"day":324,"id":"365-324","topics":["Synthetic Benchmarks vs Production Traces","Postgres High Availability: Patroni and Consensus Failover"],"domains":["perf","databases"]},{"day":325,"id":"365-325","topics":["LLM Observability: Token-Level Cost Attribution","TLS 1.3 Handshake Internals and ECH"],"domains":["ai-ml","security"]},{"day":326,"id":"365-326","topics":["Adaptive Query Execution in Modern Engines","Web Rendering Strategies: SSR, SSG, ISR, PPR"],"domains":["systems-eng","frontend"]},{"day":327,"id":"365-327","topics":["Federated Analytics Without Centralizing Data","Go Generics: Constraints and Performance Implications"],"domains":["systems-eng","perf"]},{"day":328,"id":"365-328","topics":["Incident Command Systems and Blameless Postmortems","Iceberg vs Delta vs Hudi: Format Wars Decision Guide"],"domains":["systems-eng","data-eng"]},{"day":329,"id":"365-329","topics":["Diffusion Guidance: Classifier-Free and ControlNets","API Abuse Prevention: Bot Mitigation Architecture"],"domains":["ai-ml","systems-eng"]},{"day":330,"id":"365-330","topics":["Change Failure Rate and DORA Metrics Engineering","RocksDB Tuning: Memtables, SST Files, Compaction"],"domains":["observability","databases"]},{"day":331,"id":"365-331","topics":["Multi-Model AI Systems: Ensembles and Fallbacks","Network Partitions in Practice: Jepsen Findings"],"domains":["systems-eng","systems-eng"]},{"day":332,"id":"365-332","topics":["Data Anonymization Pipelines and Re-Identification Risk","Micro-Batching vs True Streaming Runtimes"],"domains":["systems-eng","systems-eng"]},{"day":333,"id":"365-333","topics":["Program Synthesis and Formal Verification of Generated Code","Redis Keyspace Notifications and Eviction Policies"],"domains":["systems-eng","databases"]},{"day":334,"id":"365-334","topics":["Green Software Engineering and Carbon-Aware Computing","Zero-Downtime Kubernetes Upgrades"],"domains":["systems-eng","infra-cloud"]},{"day":335,"id":"365-335","topics":["Frontier Model Architectures: Trends and Trade-offs","Calvin and Deterministic Database Systems"],"domains":["systems-eng","systems-eng"]},{"day":336,"id":"365-336","topics":["Outage Case Studies: Cloud Provider Postmortems","Text Rendering and Font Loading Performance"],"domains":["infra-cloud","frontend"]},{"day":337,"id":"365-337","topics":["Embedding Quantization: PQ, OPQ, Binary Embeddings","Kubernetes API Server Flow: Auth to Storage"],"domains":["ai-ml","infra-cloud"]},{"day":338,"id":"365-338","topics":["Stream-Table Duality in Kafka Streams","Rust in Production: Rewrites and Interop Strategy"],"domains":["data-eng","systems-eng"]},{"day":339,"id":"365-339","topics":["Agentic Workflows in CI/CD Pipelines","Columnstore Indexes in Row-Store Databases"],"domains":["ai-ml","systems-eng"]},{"day":340,"id":"365-340","topics":["Resilience Metrics: MTTR, MTBF, and Their Limits","OpenTelemetry Semantic Conventions and Instrumentation Debt"],"domains":["observability","observability"]},{"day":341,"id":"365-341","topics":["On-Policy vs Off-Policy RL for LLM Post-Training","CQRS Read Model Projection Rebuilds"],"domains":["ai-ml","distributed-sys"]},{"day":342,"id":"365-342","topics":["Data Retention, TTL, and Right-to-Be-Forgotten Engineering","HTTP Preloading, Priority Hints, Early Hints"],"domains":["systems-eng","systems-eng"]},{"day":343,"id":"365-343","topics":["Model Context Windows vs External Memory Trade-offs","Consistent Hashing Variants: Jump, Rendezvous, Maglev"],"domains":["perf","distributed-sys"]},{"day":344,"id":"365-344","topics":["Privacy-Preserving Recommenders","Kernel Tracing: ftrace, kprobes, uprobes"],"domains":["security","observability"]},{"day":345,"id":"365-345","topics":["Composable Data Stack: Ibis, Substrait, Arrow Flight","Threat Hunting in Cloud Environments"],"domains":["systems-eng","infra-cloud"]},{"day":346,"id":"365-346","topics":["Benchmark Contamination and Evaluation Integrity","Sticky Sessions vs Stateless Design at the Edge"],"domains":["perf","systems-eng"]},{"day":347,"id":"365-347","topics":["Neuro-Symbolic AI Systems","MySQL vs Postgres Replication Models Compared"],"domains":["ai-ml","databases"]},{"day":348,"id":"365-348","topics":["Backward Compatibility in Event Schemas Over Years","WebAssembly GC and Language Interop"],"domains":["systems-eng","frontend"]},{"day":349,"id":"365-349","topics":["AI Safety Engineering: Interpretability Basics (SAEs, Probes)","Queue Depth, Little's Law, and Latency Percentiles"],"domains":["systems-eng","systems-eng"]},{"day":350,"id":"365-350","topics":["Declarative Data Pipelines vs Imperative Orchestration","SSH Certificates and Bastion-Less Access (Teleport)"],"domains":["systems-eng","security"]},{"day":351,"id":"365-351","topics":["Recommender Feedback Loops and Degenerate Dynamics","Kubernetes etcd Defragmentation and Performance"],"domains":["systems-eng","infra-cloud"]},{"day":352,"id":"365-352","topics":["Tail Latency Amplification in Fan-Out Systems","Browser Extension Security Model"],"domains":["systems-eng","frontend"]},{"day":353,"id":"365-353","topics":["Structured Generation: Grammars and Constrained Decoding","Change Approval Automation and Policy-as-Code"],"domains":["systems-eng","systems-eng"]},{"day":354,"id":"365-354","topics":["Heterogeneous Data Joins: Lakehouse Meets OLTP","ARM vs x86 in the Cloud: Graviton Economics"],"domains":["data-eng","infra-cloud"]},{"day":355,"id":"365-355","topics":["Simulation Testing for Agents Before Production","Postgres Prepared Statements and Plan Caching Pitfalls"],"domains":["ai-ml","databases"]},{"day":356,"id":"365-356","topics":["Autonomous Vehicles Software Architecture","Global Rate Limiting with Distributed Counters"],"domains":["systems-eng","distributed-sys"]},{"day":357,"id":"365-357","topics":["Retrieval Security: Access-Controlled RAG","V8 Deoptimization and JavaScript Performance Cliffs"],"domains":["ai-ml","backend-node"]},{"day":358,"id":"365-358","topics":["Cross-Region Data Replication Conflict Resolution","Spatial Computing and 3D Web Standards (WebXR)"],"domains":["distributed-sys","frontend"]},{"day":359,"id":"365-359","topics":["LLM Product Metrics: Engagement to Regression Detection","Zonal vs Regional Failure Domain Design"],"domains":["ai-ml","frontend"]},{"day":360,"id":"365-360","topics":["Blockchain Infrastructure: Consensus Beyond Proof-of-Work","Data Path Verification: Checksums End-to-End"],"domains":["distributed-sys","systems-eng"]},{"day":361,"id":"365-361","topics":["AI Compute Economics: Training vs Inference Cost Curves","Living Off the Land Attacks and EDR Evasion Awareness"],"domains":["systems-eng","systems-eng"]},{"day":362,"id":"365-362","topics":["Organizational Architecture: Conway's Law in System Design","Firecracker vs gVisor vs Kata: Isolation Spectrum"],"domains":["systems-eng","systems-eng"]},{"day":363,"id":"365-363","topics":["Building Internal LLM Platforms: Gateways, Quotas, Evals","Deterministic Builds and Reproducibility"],"domains":["ai-ml","systems-eng"]},{"day":364,"id":"365-364","topics":["Technical Strategy Writing for Staff+ Engineers","Migration Engineering: Dual Writes, Backfills, Cutover"],"domains":["systems-eng","systems-eng"]},{"day":365,"id":"365-365","topics":["Capstone: Designing a Planet-Scale AI-Native System","Career Synthesis: Architecture Decision Records Portfolio"],"domains":["systems-eng","systems-eng"]}];
const DAYS_45 = [{"day":1,"id":"45-1","topics":["Transformer Internals: Attention, MLP, Residual Stream","KV Cache Mechanics and Memory Math"],"domains":["ai-ml","perf"]},{"day":2,"id":"45-2","topics":["FlashAttention v2/v3 Kernel Design","Positional Encodings: RoPE, ALiBi, YaRN"],"domains":["systems-eng","systems-eng"]},{"day":3,"id":"45-3","topics":["Tokenization: BPE, SentencePiece, Failure Modes","Sampling: Temperature, Top-p, Min-p, Penalties"],"domains":["ai-ml","systems-eng"]},{"day":4,"id":"45-4","topics":["Mixture-of-Experts: Routing and Load Balancing","Long-Context Architectures and Attention Sinks"],"domains":["ai-ml","ai-ml"]},{"day":5,"id":"45-5","topics":["Quantization: GPTQ, AWQ, GGUF, FP8","Speculative Decoding and Draft Models"],"domains":["ai-ml","ai-ml"]},{"day":6,"id":"45-6","topics":["vLLM Internals: PagedAttention, Continuous Batching","Open-Weight Landscape: Llama, DeepSeek, Qwen, Mistral, Gemma, Phi"],"domains":["ai-ml","systems-eng"]},{"day":7,"id":"45-7","topics":["Chain-of-Thought to Reasoning Models: Test-Time Compute","Knowledge Distillation for LLMs"],"domains":["ai-ml","ai-ml"]},{"day":8,"id":"45-8","topics":["LoRA and QLoRA Internals","PEFT Method Selection and Adapter Merging"],"domains":["ai-ml","systems-eng"]},{"day":9,"id":"45-9","topics":["Full Fine-Tuning: FSDP and DeepSpeed ZeRO","Dataset Curation, Filtering, and Deduplication"],"domains":["ai-ml","systems-eng"]},{"day":10,"id":"45-10","topics":["RLHF Pipeline: Reward Models and PPO","Preference Optimization Compared: DPO, ORPO, KTO"],"domains":["ai-ml","ai-ml"]},{"day":11,"id":"45-11","topics":["Synthetic Data Generation and Self-Instruct","Instruction Tuning: Chat Templates and Loss Masking"],"domains":["systems-eng","perf"]},{"day":12,"id":"45-12","topics":["Constitutional AI and RLAIF","Reward Hacking and Overoptimization"],"domains":["ai-ml","ai-ml"]},{"day":13,"id":"45-13","topics":["Fine-Tune vs RAG vs Prompting: Decision Framework","Regression Evals for Fine-Tuned Models"],"domains":["ai-ml","ai-ml"]},{"day":14,"id":"45-14","topics":["GPU Memory: Gradient Checkpointing, Mixed Precision","Distributed Training: Data, Tensor, Pipeline Parallelism"],"domains":["perf","distributed-sys"]},{"day":15,"id":"45-15","topics":["Contrastive Learning and Embedding Training","Sentence Embeddings: Pooling, Matryoshka, Compression"],"domains":["ai-ml","ai-ml"]},{"day":16,"id":"45-16","topics":["Vector Index Internals: HNSW, IVF, PQ","Vector DB Selection: FAISS, Milvus, Qdrant, pgvector, Pinecone, Weaviate"],"domains":["ai-ml","ai-ml"]},{"day":17,"id":"45-17","topics":["Advanced Chunking: Semantic, Hierarchical, Late","Hybrid Search: BM25 + Dense Fusion (RRF)"],"domains":["systems-eng","systems-eng"]},{"day":18,"id":"45-18","topics":["Cross-Encoders and Reranking Models","Query Rewriting and HyDE"],"domains":["ai-ml","systems-eng"]},{"day":19,"id":"45-19","topics":["GraphRAG and Knowledge Graph Integration","Multi-Hop Retrieval and Query Decomposition"],"domains":["ai-ml","ai-ml"]},{"day":20,"id":"45-20","topics":["Context Compression and Pruning","Retrieval Evaluation: Recall@K, NDCG, MRR"],"domains":["systems-eng","ai-ml"]},{"day":21,"id":"45-21","topics":["Agentic RAG and Self-RAG","RAG Framework Internals: LlamaIndex and Haystack"],"domains":["ai-ml","ai-ml"]},{"day":22,"id":"45-22","topics":["Agent Architectures: ReAct to Plan-and-Execute","Tool and Function Calling: Schemas, Reliability, Retries"],"domains":["ai-ml","systems-eng"]},{"day":23,"id":"45-23","topics":["Model Context Protocol: Servers, Tools, Resources","Secure Tool Calling and Agent Sandboxing"],"domains":["systems-eng","ai-ml"]},{"day":24,"id":"45-24","topics":["Multi-Agent Systems: Orchestrator-Worker Patterns","Agent Memory: Episodic, Semantic, Compaction"],"domains":["ai-ml","ai-ml"]},{"day":25,"id":"45-25","topics":["LangChain and LangGraph Internals: State, Checkpointing","Reflection and Self-Correction Loops"],"domains":["ai-ml","systems-eng"]},{"day":26,"id":"45-26","topics":["Planning Algorithms: Tree of Thoughts, MCTS, Self-Consistency","Long-Horizon Agents and Context Management"],"domains":["ai-ml","ai-ml"]},{"day":27,"id":"45-27","topics":["Human-in-the-Loop and Approval Workflows","Agent Frameworks Compared: CrewAI, AutoGen, Semantic Kernel, PydanticAI, OpenAI Agents SDK"],"domains":["systems-eng","ai-ml"]},{"day":28,"id":"45-28","topics":["Agent Evaluation: Trajectory Metrics and Benchmarks","DSPy: Programmatic Prompting and Optimizers"],"domains":["ai-ml","ai-ml"]},{"day":29,"id":"45-29","topics":["TensorRT-LLM and Kernel-Level Optimization","Triton Inference Server: Ensembles and Dynamic Batching"],"domains":["ai-ml","ai-ml"]},{"day":30,"id":"45-30","topics":["Serving Engines Compared: vLLM, TGI, SGLang","Distributed Inference: Tensor and Pipeline Parallel Serving"],"domains":["ai-ml","distributed-sys"]},{"day":31,"id":"45-31","topics":["GPU Scheduling on Kubernetes: MIG, Time-Slicing, Kueue","Ray and Ray Serve for AI Workloads"],"domains":["infra-cloud","systems-eng"]},{"day":32,"id":"45-32","topics":["Prefix and Prompt Caching Economics","Structured Generation: Grammars, JSON Schema, Constrained Decoding"],"domains":["ai-ml","systems-eng"]},{"day":33,"id":"45-33","topics":["Deploying Vision-Language Models in Production","AI API Design: Batch, Real-Time, and Streaming Interfaces"],"domains":["ai-ml","systems-eng"]},{"day":34,"id":"45-34","topics":["Multi-Model Routing and Cascades","AI Gateway Design: Quotas, Keys, Rate Limits, Fallbacks"],"domains":["systems-eng","systems-eng"]},{"day":35,"id":"45-35","topics":["Semantic Caching for LLM APIs","Inference Cost Engineering: Tokens, Hardware, Utilization"],"domains":["ai-ml","systems-eng"]},{"day":36,"id":"45-36","topics":["Prompt Versioning and Management Systems","Experiment Tracking and Model Registries: MLflow, W&B"],"domains":["ai-ml","systems-eng"]},{"day":37,"id":"45-37","topics":["LLM Observability: LangSmith, Langfuse, OTel GenAI","Hallucination Detection and Faithfulness Metrics"],"domains":["ai-ml","ai-ml"]},{"day":38,"id":"45-38","topics":["Evaluation Pipelines: RAGAS, DeepEval, Custom Harnesses","LLM-as-Judge: Bias, Calibration, Reliability"],"domains":["ai-ml","ai-ml"]},{"day":39,"id":"45-39","topics":["Benchmarks: HELM, MMLU-Pro, SWE-bench, Arena","Human Evaluation Design and Inter-Rater Agreement"],"domains":["infra-cloud","systems-eng"]},{"day":40,"id":"45-40","topics":["CI/CD for AI: Eval Gates and Canary Prompts","Production Model Monitoring and Drift Detection"],"domains":["ai-ml","observability"]},{"day":41,"id":"45-41","topics":["Prompt Injection: Direct, Indirect, Defenses","Jailbreaks, Prompt Leakage, and Red Teaming"],"domains":["ai-ml","ai-ml"]},{"day":42,"id":"45-42","topics":["Privacy in LLM Systems: PII Handling, Data Retention","AI Governance: Risk Assessment, EU AI Act, Model Cards"],"domains":["ai-ml","security"]},{"day":43,"id":"45-43","topics":["Diffusion Models: DDPM, Latent Diffusion, Flow Matching","Video Generation and Image Editing Architectures"],"domains":["ai-ml","systems-eng"]},{"day":44,"id":"45-44","topics":["Vision-Language Models: CLIP to Video Understanding","Speech Stack: ASR, TTS, Real-Time Voice Agents"],"domains":["ai-ml","ai-ml"]},{"day":45,"id":"45-45","topics":["World Models and Frontier Research Directions","Capstone: End-to-End Production AI System Design"],"domains":["ai-ml","systems-eng"]}];
const DOMAIN_META = {"ai-ml": {"label": "AI / ML"}, "backend-node": {"label": "Node / Nest"}, "frontend": {"label": "Frontend"}, "databases": {"label": "Databases"}, "infra-cloud": {"label": "Cloud / Infra"}, "data-eng": {"label": "Data Eng"}, "distributed-sys": {"label": "Distributed Sys"}, "security": {"label": "Security"}, "observability": {"label": "Observability"}, "perf": {"label": "Performance"}, "systems-eng": {"label": "Systems Eng"}};

/* ============================== THEMES ============================== */
const DOMAIN_PALETTES = {
  dark: {
    "ai-ml": "#F5A623", "backend-node": "#3FE0D0", "frontend": "#C792EA",
    "databases": "#6EE7B7", "infra-cloud": "#60A5FA", "data-eng": "#F472B6",
    "distributed-sys": "#FB923C", "security": "#EF4444", "observability": "#A3E635",
    "perf": "#FACC15", "systems-eng": "#94A3B8",
  },
  light: {
    "ai-ml": "#B4730A", "backend-node": "#0E8C7F", "frontend": "#7C3AED",
    "databases": "#10855F", "infra-cloud": "#1D4ED8", "data-eng": "#BE185D",
    "distributed-sys": "#C2410C", "security": "#B91C1C", "observability": "#4D7C0F",
    "perf": "#A16207", "systems-eng": "#4B5563",
  },
  muted: {
    "ai-ml": "#C4A052", "backend-node": "#5FA89C", "frontend": "#9A8CBF",
    "databases": "#74A88A", "infra-cloud": "#7B94BF", "data-eng": "#B98BA0",
    "distributed-sys": "#C08F6B", "security": "#BE7A7A", "observability": "#9AAE72",
    "perf": "#C0AE6A", "systems-eng": "#8C9199",
  },
};

const FONT_STACKS = {
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: "'Inter', -apple-system, sans-serif",
  serif: "'Source Serif 4', Georgia, serif",
  grotesk: "'Space Grotesk', 'Inter', sans-serif",
};

const THEMES = {
  bloom: {
    name: "Bloom", mode: "light", palette: "light", effects: true,
    swatch: ["#F2F9FF", "#2E9BE6", "#FF3D9A"],
    accents: { main: "#2E9BE6", sprint: "#FF3D9A" },
    display: FONT_STACKS.grotesk,
    radius: { card: "16px", ctl: "10px", pill: "999px", bar: "6px" },
    grid: { color: "rgba(46,155,230,0.10)", size: "40px", scan: "0" },
    c: {
      bg: "#F2F9FF", panel: "#FFFFFF", panel2: "#F7FBFF", blur: "rgba(242,249,255,0.82)",
      text: "#12283A", dim: "#4A6B80", faint: "#6F879A",
      border: "rgba(18,40,58,0.10)", borderSoft: "rgba(18,40,58,0.06)", borderHover: "rgba(18,40,58,0.22)",
      track: "rgba(18,40,58,0.10)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.85)",
      ok: "#0E9F6E", warn: "#D97706", err: "#DC2626", info: "#2E9BE6",
    },
  },
  ledger: {
    name: "Ledger", mode: "light", palette: "light", effects: false,
    swatch: ["#FAF6EC", "#A9703B", "#6B5335"],
    accents: { main: "#A9703B", sprint: "#6B7F3A" },
    display: FONT_STACKS.serif,
    radius: { card: "4px", ctl: "3px", pill: "3px", bar: "2px" },
    grid: { color: "rgba(107,83,53,0.07)", size: "44px", scan: "0" },
    c: {
      bg: "#FAF6EC", panel: "#FFFDF7", panel2: "#F4EEDF", blur: "rgba(250,246,236,0.85)",
      text: "#2E2618", dim: "#6B5D46", faint: "#8F8169",
      border: "rgba(46,38,24,0.14)", borderSoft: "rgba(46,38,24,0.08)", borderHover: "rgba(46,38,24,0.30)",
      track: "rgba(46,38,24,0.10)", onAccent: "#FFFDF7", onAccentSoft: "rgba(255,253,247,0.9)",
      ok: "#3F6B2B", warn: "#A9703B", err: "#9B2C1F", info: "#4A6B8A",
    },
  },
  terminal: {
    name: "Terminal", mode: "dark", palette: "dark", effects: true,
    swatch: ["#0C1116", "#3DDC97", "#22D3EE"],
    accents: { main: "#3DDC97", sprint: "#22D3EE" },
    display: FONT_STACKS.mono,
    radius: { card: "8px", ctl: "5px", pill: "6px", bar: "3px" },
    grid: { color: "rgba(61,220,151,0.05)", size: "36px", scan: "0.5" },
    c: {
      bg: "#0C1116", panel: "#121A21", panel2: "#16202A", blur: "rgba(12,17,22,0.72)",
      text: "#D6E4E0", dim: "#7E948E", faint: "#5B6F6B",
      border: "rgba(214,228,224,0.10)", borderSoft: "rgba(214,228,224,0.06)", borderHover: "rgba(214,228,224,0.24)",
      track: "rgba(214,228,224,0.10)", onAccent: "#08120E", onAccentSoft: "rgba(8,18,14,0.7)",
      ok: "#3DDC97", warn: "#FACC15", err: "#F87171", info: "#22D3EE",
    },
  },
  pebble: {
    name: "Pebble", mode: "light", palette: "light", effects: true,
    swatch: ["#F4EDE2", "#C4643C", "#8A6A4F"],
    accents: { main: "#C4643C", sprint: "#7A8B6F" },
    display: FONT_STACKS.grotesk,
    radius: { card: "18px", ctl: "12px", pill: "999px", bar: "8px" },
    grid: { color: "rgba(122,94,66,0.07)", size: "46px", scan: "0" },
    c: {
      bg: "#F4EDE2", panel: "#FFFAF2", panel2: "#EFE5D6", blur: "rgba(244,237,226,0.84)",
      text: "#33281E", dim: "#6F5F4E", faint: "#8D7A64",
      border: "rgba(51,40,30,0.12)", borderSoft: "rgba(51,40,30,0.07)", borderHover: "rgba(51,40,30,0.26)",
      track: "rgba(51,40,30,0.10)", onAccent: "#FFFAF2", onAccentSoft: "rgba(255,250,242,0.9)",
      ok: "#4F7A3F", warn: "#C4843C", err: "#B03A28", info: "#4A6B8A",
    },
  },
  graphite: {
    name: "Graphite", mode: "light", palette: "light", effects: false,
    swatch: ["#EDEFF2", "#2563EB", "#5B6472"],
    accents: { main: "#2563EB", sprint: "#0F766E" },
    display: FONT_STACKS.mono,
    radius: { card: "2px", ctl: "2px", pill: "2px", bar: "1px" },
    grid: { color: "rgba(40,48,60,0.06)", size: "32px", scan: "0" },
    c: {
      bg: "#EDEFF2", panel: "#FBFCFD", panel2: "#E4E7EC", blur: "rgba(237,239,242,0.85)",
      text: "#1B2230", dim: "#5B6472", faint: "#777F8D",
      border: "rgba(27,34,48,0.14)", borderSoft: "rgba(27,34,48,0.08)", borderHover: "rgba(27,34,48,0.32)",
      track: "rgba(27,34,48,0.10)", onAccent: "#FFFFFF", onAccentSoft: "rgba(255,255,255,0.9)",
      ok: "#15803D", warn: "#B45309", err: "#B91C1C", info: "#2563EB",
    },
  },
  parchment: {
    name: "Parchment", mode: "light", palette: "light", effects: true,
    swatch: ["#F6EFE0", "#6B7F3A", "#8A7A55"],
    accents: { main: "#6B7F3A", sprint: "#A9703B" },
    display: FONT_STACKS.serif,
    radius: { card: "14px", ctl: "10px", pill: "999px", bar: "6px" },
    grid: { color: "rgba(107,127,58,0.07)", size: "42px", scan: "0" },
    c: {
      bg: "#F6EFE0", panel: "#FDF9EF", panel2: "#F0E7D4", blur: "rgba(246,239,224,0.84)",
      text: "#2F2E22", dim: "#67654F", faint: "#847F62",
      border: "rgba(47,46,34,0.13)", borderSoft: "rgba(47,46,34,0.07)", borderHover: "rgba(47,46,34,0.28)",
      track: "rgba(47,46,34,0.10)", onAccent: "#FDF9EF", onAccentSoft: "rgba(253,249,239,0.9)",
      ok: "#4F7A3F", warn: "#A9703B", err: "#9B2C1F", info: "#4A6B8A",
    },
  },
  blueprint: {
    name: "Blueprint", mode: "dark", palette: "dark", effects: true,
    swatch: ["#0B2545", "#F5A623", "#7FB2E5"],
    accents: { main: "#F5A623", sprint: "#7FB2E5" },
    display: FONT_STACKS.mono,
    radius: { card: "4px", ctl: "3px", pill: "4px", bar: "2px" },
    grid: { color: "rgba(160,200,240,0.16)", size: "28px", scan: "0" },
    c: {
      bg: "#0B2545", panel: "#102E52", panel2: "#143760", blur: "rgba(11,37,69,0.75)",
      text: "#DCE9F7", dim: "#8FAFCF", faint: "#5E7FA3",
      border: "rgba(220,233,247,0.16)", borderSoft: "rgba(220,233,247,0.09)", borderHover: "rgba(220,233,247,0.32)",
      track: "rgba(220,233,247,0.14)", onAccent: "#0B2545", onAccentSoft: "rgba(11,37,69,0.75)",
      ok: "#6EE7B7", warn: "#F5A623", err: "#F87171", info: "#7FB2E5",
    },
  },
  matte: {
    name: "Matte Black", mode: "dark", palette: "muted", effects: false,
    swatch: ["#0B0B0C", "#C9CBD1", "#7E8189"],
    accents: { main: "#C9CBD1", sprint: "#8E9299" },
    display: FONT_STACKS.mono,
    radius: { card: "6px", ctl: "4px", pill: "6px", bar: "2px" },
    grid: { color: "rgba(255,255,255,0.022)", size: "40px", scan: "0" },
    c: {
      bg: "#0B0B0C", panel: "#141416", panel2: "#1B1B1E", blur: "rgba(11,11,12,0.78)",
      text: "#E4E4E6", dim: "#8B8C90", faint: "#67686C",
      border: "rgba(255,255,255,0.08)", borderSoft: "rgba(255,255,255,0.05)", borderHover: "rgba(255,255,255,0.20)",
      track: "rgba(255,255,255,0.08)", onAccent: "#0B0B0C", onAccentSoft: "rgba(11,11,12,0.75)",
      ok: "#A8AAAF", warn: "#B9BBC0", err: "#C98A8A", info: "#9FA2A8",
    },
  },
};

const THEME_ORDER = ["bloom", "ledger", "terminal", "pebble", "graphite", "parchment", "blueprint", "matte"];

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function themeVars(t) {
  const c = t.c;
  return {
    "--bg": c.bg, "--bg-panel": c.panel, "--bg-panel-2": c.panel2, "--bg-blur": c.blur,
    "--text": c.text, "--text-dim": c.dim, "--text-faint": c.faint,
    "--border": c.border, "--border-soft": c.borderSoft, "--border-hover": c.borderHover,
    "--track": c.track, "--on-accent": c.onAccent, "--on-accent-soft": c.onAccentSoft,
    "--ok": c.ok, "--warn": c.warn, "--err": c.err, "--info": c.info,
    "--accent-main": t.accents.main, "--accent-sprint": t.accents.sprint,
    "--display": t.display, "--mono": FONT_STACKS.mono, "--sans": FONT_STACKS.sans,
    "--r-card": t.radius.card, "--r-ctl": t.radius.ctl, "--r-pill": t.radius.pill, "--r-bar": t.radius.bar,
    "--grid-color": t.grid.color, "--grid-size": t.grid.size, "--scan-op": t.grid.scan,
    "--dot-glow": t.effects ? "0 0 8px currentColor" : "none",
  };
}

const ThemeCtx = createContext({ theme: THEMES.terminal, domainColors: DOMAIN_PALETTES.dark });

const CAMPAIGNS = {
  main: {
    key: "main",
    name: "OPERATION LONGHAUL",
    subtitle: "365-Day Full-Stack & Systems Campaign",
    days: DAYS_365,
    unit: "day",
    totalDays: 365,
  },
  sprint: {
    key: "sprint",
    name: "OPERATION FASTBURN",
    subtitle: "45-Day AI / LLM Engineer Intensive",
    days: DAYS_45,
    unit: "day",
    totalDays: 45,
  },
};

/* ============================== PERIODS ============================== */
/* Boundaries mirror the actual section splits in each roadmap document. */
const QUARTERS_365 = [
  { label: "Q1", sub: "Foundations of depth", start: 1, end: 90 },
  { label: "Q2", sub: "Scale and systems", start: 91, end: 181 },
  { label: "Q3", sub: "Frontier engineering", start: 182, end: 273 },
  { label: "Q4", sub: "Synthesis", start: 274, end: 365 },
];

const MONTHS_365 = [
  { label: "Jan", sub: "New-stack ramp-up", start: 1, end: 31 },
  { label: "Feb", sub: "Stack depth", start: 32, end: 59 },
  { label: "Mar", sub: "Core systems", start: 60, end: 90 },
  { label: "Apr", sub: "Scale patterns", start: 91, end: 120 },
  { label: "May", sub: "Deep internals", start: 121, end: 151 },
  { label: "Jun", sub: "Reliability", start: 152, end: 181 },
  { label: "Jul", sub: "Advanced data", start: 182, end: 212 },
  { label: "Aug", sub: "Storage and search", start: 213, end: 243 },
  { label: "Sep", sub: "Retrieval and infra", start: 244, end: 273 },
  { label: "Oct", sub: "Emerging frontiers", start: 274, end: 304 },
  { label: "Nov", sub: "Operations", start: 305, end: 334 },
  { label: "Dec", sub: "Capstone", start: 335, end: 365 },
];

const WEEKS_45 = [
  { label: "Week 1", sub: "Model internals", start: 1, end: 7 },
  { label: "Week 2", sub: "Fine-tuning", start: 8, end: 14 },
  { label: "Week 3", sub: "Embeddings and RAG", start: 15, end: 21 },
  { label: "Week 4", sub: "Agents", start: 22, end: 28 },
  { label: "Week 5", sub: "Serving infra", start: 29, end: 35 },
  { label: "Week 6", sub: "LLMOps and security", start: 36, end: 42 },
  { label: "Week 7", sub: "Multimodal capstone", start: 43, end: 45 },
];

function buildWeeks(totalDays) {
  const out = [];
  for (let start = 1; start <= totalDays; start += 7) {
    const end = Math.min(start + 6, totalDays);
    out.push({ label: `W${out.length + 1}`, sub: `Days ${start}-${end}`, start, end });
  }
  return out;
}

function periodsFor(campaignKey, scope, totalDays) {
  if (scope === "all") return null;
  if (campaignKey === "main") {
    if (scope === "quarter") return QUARTERS_365;
    if (scope === "month") return MONTHS_365;
    return buildWeeks(totalDays);
  }
  if (scope === "week") return WEEKS_45;
  return null;
}

function scopesFor(campaignKey) {
  return campaignKey === "main"
    ? [{ key: "all", label: "All days" }, { key: "quarter", label: "Quarter" }, { key: "month", label: "Month" }, { key: "week", label: "Week" }]
    : [{ key: "all", label: "All days" }, { key: "week", label: "Week" }];
}

/* ============================== SPACED REPETITION ============================== */
const DAY_MS = 86400000;
const SRS_INTERVALS = [7, 30, 90, 180];
const LAPSE_DAYS = 3;

function seedReview(now) {
  return { idx: 0, due: now + SRS_INTERVALS[0] * DAY_MS, graduated: false, reps: 0, last: now };
}

function nextReview(entry, outcome, now) {
  const cur = entry && typeof entry.idx === "number" ? entry.idx : 0;
  const reps = (entry && entry.reps ? entry.reps : 0) + 1;
  if (outcome === "solid") {
    const idx = cur + 1;
    if (idx >= SRS_INTERVALS.length) {
      return { idx: SRS_INTERVALS.length - 1, due: null, graduated: true, reps, last: now };
    }
    return { idx, due: now + SRS_INTERVALS[idx] * DAY_MS, graduated: false, reps, last: now };
  }
  if (outcome === "shaky") {
    return { idx: cur, due: now + SRS_INTERVALS[cur] * DAY_MS, graduated: false, reps, last: now };
  }
  return { idx: 0, due: now + LAPSE_DAYS * DAY_MS, graduated: false, reps, last: now };
}

function dueList(srs, allDays, now) {
  const out = [];
  for (const d of allDays) {
    const e = srs[d.id];
    if (!e || e.graduated || !e.due) continue;
    if (e.due <= now) out.push({ day: d, entry: e });
  }
  out.sort((a, b) => a.entry.due - b.entry.due);
  return out;
}

function relativeDue(ts, now) {
  if (!ts) return "graduated";
  const diff = Math.round((ts - now) / DAY_MS);
  if (diff <= 0) return "due now";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}

/* ============================== RELATED DAYS ============================== */
const STOPWORDS = new Set(["the","and","for","with","from","into","that","this","your","are","its",
  "how","why","what","when","design","designs","patterns","pattern","internals","internal","deep","dive",
  "advanced","modern","production","systems","system","using","use","based","across","over","under","vs"]);

function tokenizeTopic(t) {
  return t.toLowerCase()
    .replace(/[^a-z0-9+#.\- ]/g, " ")
    .split(/[\s\-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function buildRelatedIndex(days) {
  const dayTokens = new Map();
  const df = new Map();
  for (const d of days) {
    const set = new Set();
    d.topics.forEach((t) => tokenizeTopic(t).forEach((w) => set.add(w)));
    dayTokens.set(d.id, set);
    set.forEach((w) => df.set(w, (df.get(w) || 0) + 1));
  }
  const n = days.length;
  const idf = new Map();
  df.forEach((c, w) => idf.set(w, Math.log(n / (1 + c))));
  return { dayTokens, idf };
}

function relatedDaysFor(day, days, index, limit) {
  const mine = index.dayTokens.get(day.id);
  if (!mine) return [];
  const scored = [];
  for (const other of days) {
    if (other.id === day.id) continue;
    const theirs = index.dayTokens.get(other.id);
    let score = 0;
    const shared = [];
    mine.forEach((w) => {
      if (theirs.has(w)) {
        const weight = Math.max(0.15, index.idf.get(w) || 0);
        score += weight;
        shared.push({ w, weight });
      }
    });
    if (score <= 0) continue;
    const sharedDomain = other.domains.some((dm) => day.domains.includes(dm));
    if (sharedDomain) score += 0.45;
    shared.sort((a, b) => b.weight - a.weight);
    scored.push({ day: other, score, terms: shared.slice(0, 3).map((x) => x.w) });
  }
  scored.sort((a, b) => b.score - a.score || a.day.day - b.day.day);
  return scored.filter((x) => x.score >= 1.1).slice(0, limit || 3);
}

/* ============================== CLAUDE API ============================== */
async function callClaude(prompt, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens || 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("Request failed (" + res.status + ")");
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Empty response");
  return text;
}

function stripFences(t) {
  return t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

/* ============================== FILE IO ============================== */
function downloadText(filename, text, mime) {
  try {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

/* ============================== HELPERS ============================== */
const XP_PER_TOPIC = 15;
const XP_PER_DAY_BONUS = 10;

function levelFromXp(xp) {
  // level curve: level n requires n*140 cumulative xp roughly
  let level = 1;
  let remain = xp;
  let need = 120;
  while (remain >= need) {
    remain -= need;
    level += 1;
    need = Math.round(need * 1.11);
  }
  return { level, into: remain, need };
}

function rankForLevel(level) {
  const ranks = [
    [1, "Recruit"],
    [4, "Operator"],
    [8, "Specialist"],
    [13, "Engineer II"],
    [19, "Senior Engineer"],
    [26, "Staff Candidate"],
    [34, "Staff Engineer"],
    [43, "Principal Track"],
    [53, "Distinguished Track"],
    [65, "Architect"],
  ];
  let r = ranks[0][1];
  for (const [lvl, name] of ranks) {
    if (level >= lvl) r = name;
  }
  return r;
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ============================== PERSISTENCE ============================== */
const STORAGE_KEY = "dualtrack:state:v1";

function hasStorage() {
  return typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
}

async function loadState() {
  if (!hasStorage()) return null;
  try {
    const res = await window.storage.get(STORAGE_KEY);
    if (res && res.value) return JSON.parse(res.value);
  } catch (e) {
    // key does not exist yet, or storage unavailable
  }
  return null;
}

async function saveState(state) {
  if (!hasStorage()) return false;
  try {
    const res = await window.storage.set(STORAGE_KEY, JSON.stringify(state));
    return !!res;
  } catch (e) {
    return false;
  }
}

async function clearState() {
  if (!hasStorage()) return false;
  try {
    await window.storage.delete(STORAGE_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

/* ============================== ICONS (inline svg, no deps) ============================== */
const Icon = {
  Bolt: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Flame: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Chevron: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Target: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" />
    </svg>
  ),
  Terminal: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Grid: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  List: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Trophy: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h3a2 2 0 0 1-2 4M7 5H4a2 2 0 0 0 2 4" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Note: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  Book: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Calendar: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Send: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Download: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Cloud: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  Rotate: (p) => (
    <svg viewBox="0 0 24 24" width={p.size||16} height={p.size||16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
};

/* ============================== ROOT APP ============================== */
export default function App() {
  const [progress, setProgress] = useState({}); // { "365-1": {0:bool, 1:bool} , ...}
  const [notes, setNotes] = useState({});       // { "365-1": "text" }
  const [activeCampaign, setActiveCampaign] = useState("main");
  const [view, setView] = useState("console"); // console | grid | log
  const [query, setQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [scope, setScope] = useState("all");     // all | quarter | month | week
  const [periodIdx, setPeriodIdx] = useState(0);
  const [toast, setToast] = useState(null);
  const [confetti, setConfetti] = useState(null);
  const [refs, setRefs] = useState({}); // { dayId: {text, topic, style, at} }
  const [srs, setSrs] = useState({});   // { dayId: {idx, due, graduated, reps, last} }
  const [log, setLog] = useState([]);   // [{d: dayId, i: topicIdx, at: ts}]
  const [modal, setModal] = useState(null); // {kind, day?}
  const [themeKey, setThemeKey] = useState("terminal");
  const [saveStatus, setSaveStatus] = useState("loading"); // loading | idle | saving | saved | error | off
  const [confirmReset, setConfirmReset] = useState(false);
  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const didLoad = useRef(false);

  const theme = THEMES[themeKey] || THEMES.terminal;
  const domainColors = DOMAIN_PALETTES[theme.palette];

  const themedCampaigns = useMemo(() => {
    const out = {};
    Object.keys(CAMPAIGNS).forEach((k) => {
      const accent = theme.accents[k === "main" ? "main" : "sprint"];
      out[k] = {
        ...CAMPAIGNS[k],
        accent,
        glow: theme.effects ? hexToRgba(accent, 0.35) : "transparent",
      };
    });
    return out;
  }, [theme]);

  const campaign = themedCampaigns[activeCampaign];

  /* ---------- load saved state once on mount ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasStorage()) {
        if (!cancelled) { didLoad.current = true; setSaveStatus("off"); }
        return;
      }
      const saved = await loadState();
      if (cancelled) return;
      if (saved) {
        if (saved.progress) setProgress(saved.progress);
        if (saved.notes) setNotes(saved.notes);
        if (saved.refs) setRefs(saved.refs);
        if (saved.srs) setSrs(saved.srs);
        if (Array.isArray(saved.log)) setLog(saved.log);
        if (saved.themeKey && THEMES[saved.themeKey]) setThemeKey(saved.themeKey);
      }
      didLoad.current = true;
      setSaveStatus("idle");
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------- debounced autosave whenever progress or notes change ---------- */
  useEffect(() => {
    if (!didLoad.current) return;
    if (!hasStorage()) return;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveState({ progress, notes, refs, srs, log, themeKey, updatedAt: Date.now() });
      setSaveStatus(ok ? "saved" : "error");
      if (ok) setTimeout(() => setSaveStatus((cur) => (cur === "saved" ? "idle" : cur)), 1600);
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [progress, notes, refs, srs, log, themeKey]);

  /* ---------- keep scope valid when switching campaigns ---------- */
  useEffect(() => {
    const allowed = scopesFor(activeCampaign).map((x) => x.key);
    if (!allowed.includes(scope)) setScope("all");
    setPeriodIdx(0);
  }, [activeCampaign]);

  const setRef = useCallback((dayId, payload) => {
    setRefs((prev) => {
      const next = { ...prev };
      if (payload) next[dayId] = payload;
      else delete next[dayId];
      return next;
    });
  }, []);

  const appendNote = useCallback((dayId, text) => {
    setNotes((prev) => {
      const cur = prev[dayId] || "";
      const joined = cur.trim() ? cur.trimEnd() + "\n\n" + text : text;
      return { ...prev, [dayId]: joined };
    });
  }, []);

  const setNote = useCallback((dayId, text) => {
    setNotes((prev) => {
      const next = { ...prev };
      if (text && text.trim()) next[dayId] = text;
      else delete next[dayId];
      return next;
    });
  }, []);

  const handleReset = useCallback(async () => {
    setProgress({});
    setNotes({});
    setRefs({});
    setSrs({});
    setLog([]);
    await clearState();
    setConfirmReset(false);
    setSaveStatus("idle");
  }, []);

  const setTopicDone = useCallback((dayId, topicIdx, done) => {
    setProgress((prev) => {
      const cur = prev[dayId] || {};
      const next = { ...cur, [topicIdx]: done };
      return { ...prev, [dayId]: next };
    });
  }, []);

  const isDayComplete = useCallback((day) => {
    const p = progress[day.id];
    if (!p) return false;
    return day.topics.every((_, i) => p[i]);
  }, [progress]);

  const topicsDoneCount = useCallback((day) => {
    const p = progress[day.id];
    if (!p) return 0;
    return day.topics.filter((_, i) => p[i]).length;
  }, [progress]);

  /* ---------- derived stats across BOTH campaigns ---------- */
  const globalStats = useMemo(() => {
    let totalTopics = 0, doneTopics = 0, daysComplete = 0, totalDaysAll = 0;
    Object.values(CAMPAIGNS).forEach((c) => {
      c.days.forEach((d) => {
        totalDaysAll += 1;
        totalTopics += d.topics.length;
        const p = progress[d.id];
        let allDone = true;
        d.topics.forEach((_, i) => {
          if (p && p[i]) doneTopics += 1;
          else allDone = false;
        });
        if (allDone && p) daysComplete += 1;
      });
    });
    const xp = doneTopics * XP_PER_TOPIC + daysComplete * XP_PER_DAY_BONUS;
    const { level, into, need } = levelFromXp(xp);
    return { totalTopics, doneTopics, daysComplete, totalDaysAll, xp, level, into, need, rank: rankForLevel(level) };
  }, [progress]);

  const campaignStats = useMemo(() => {
    const stats = {};
    Object.values(CAMPAIGNS).forEach((c) => {
      let doneTopics = 0, daysComplete = 0;
      const domainTally = {};
      c.days.forEach((d) => {
        const p = progress[d.id];
        let allDone = true;
        d.topics.forEach((_, i) => {
          if (p && p[i]) doneTopics += 1;
          else allDone = false;
        });
        if (allDone && p) daysComplete += 1;
        d.domains.forEach((dom, i) => {
          if (!domainTally[dom]) domainTally[dom] = { total: 0, done: 0 };
          domainTally[dom].total += 1;
          if (p && p[i]) domainTally[dom].done += 1;
        });
      });
      // streak: consecutive days (from day 1) fully complete
      let streak = 0;
      for (const d of c.days) {
        if (isDayComplete(d)) streak += 1; else break;
      }
      // current active day = first incomplete day
      let activeDay = c.days.find((d) => !isDayComplete(d)) || c.days[c.days.length - 1];
      stats[c.key] = {
        doneTopics,
        totalTopics: c.days.length * 2,
        daysComplete,
        totalDays: c.days.length,
        pct: Math.round((doneTopics / (c.days.length * 2)) * 100),
        domainTally,
        streak,
        activeDay,
      };
    });
    return stats;
  }, [progress, isDayComplete]);

  const fireToast = useCallback((msg, kind) => {
    setToast({ msg, kind, id: Math.random() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleToggleTopic = useCallback((day, idx, campaignObj) => {
    const currentlyDone = !!(progress[day.id] && progress[day.id][idx]);
    const willBeDone = !currentlyDone;
    const now = Date.now();
    setTopicDone(day.id, idx, willBeDone);

    setLog((prev) => willBeDone
      ? [...prev, { d: day.id, i: idx, at: now }]
      : prev.filter((e) => !(e.d === day.id && e.i === idx)));

    const otherIdxAll = day.topics.map((_, i) => i).filter((i) => i !== idx);
    const othersDone = otherIdxAll.every((i) => !!(progress[day.id] && progress[day.id][i]));
    if (willBeDone && othersDone) {
      setSrs((prev) => (prev[day.id] ? prev : { ...prev, [day.id]: seedReview(now) }));
    }
    if (!willBeDone) {
      setSrs((prev) => {
        if (!prev[day.id]) return prev;
        const next = { ...prev };
        delete next[day.id];
        return next;
      });
    }

    if (willBeDone) {
      fireToast(`+${XP_PER_TOPIC} XP · ${day.topics[idx]}`, "xp");
      // check if this completes the day
      const otherIdx = idx === 0 ? 1 : 0;
      const otherDone = day.topics.length === 1 ? true : !!(progress[day.id] && progress[day.id][otherIdx]);
      if (otherDone || day.topics.length === 1) {
        setTimeout(() => {
          setConfetti({ id: Math.random(), color: campaignObj.accent });
          fireToast(`DAY ${day.day} COMPLETE · +${XP_PER_DAY_BONUS} bonus XP`, "day");
          setTimeout(() => setConfetti(null), 1400);
        }, 250);
      }
    }
  }, [progress, setTopicDone, fireToast]);

  /* ---------- review grading ---------- */
  const gradeReview = useCallback((dayId, outcome) => {
    const now = Date.now();
    setSrs((prev) => ({ ...prev, [dayId]: nextReview(prev[dayId], outcome, now) }));
  }, []);

  /* ---------- import ---------- */
  const applyImport = useCallback((data) => {
    if (!data || typeof data !== "object") throw new Error("Not a DualTrack backup file");
    if (!data.progress && !data.notes) throw new Error("No progress or notes found in that file");
    setProgress(data.progress && typeof data.progress === "object" ? data.progress : {});
    setNotes(data.notes && typeof data.notes === "object" ? data.notes : {});
    setRefs(data.refs && typeof data.refs === "object" ? data.refs : {});
    setSrs(data.srs && typeof data.srs === "object" ? data.srs : {});
    setLog(Array.isArray(data.log) ? data.log : []);
    if (data.themeKey && THEMES[data.themeKey]) setThemeKey(data.themeKey);
  }, []);

  /* ---------- period list with per-period completion ---------- */
  const periods = useMemo(() => {
    const list = periodsFor(campaign.key, scope, campaign.totalDays);
    if (!list) return null;
    return list.map((p) => {
      let total = 0, done = 0;
      for (const d of campaign.days) {
        if (d.day < p.start || d.day > p.end) continue;
        const pr = progress[d.id];
        total += d.topics.length;
        d.topics.forEach((_, i) => { if (pr && pr[i]) done += 1; });
      }
      return { ...p, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  }, [campaign, scope, progress]);

  /* ---------- when scope changes, jump to the period holding the active day ---------- */
  const activeDayNum = campaignStats[campaign.key].activeDay
    ? campaignStats[campaign.key].activeDay.day
    : 1;
  useEffect(() => {
    if (scope === "all") return;
    const list = periodsFor(campaign.key, scope, campaign.totalDays);
    if (!list) return;
    const idx = list.findIndex((p) => activeDayNum >= p.start && activeDayNum <= p.end);
    setPeriodIdx(idx >= 0 ? idx : 0);
    // eslint-disable-next-line
  }, [scope]);

  const activePeriod = periods && periods[Math.min(periodIdx, periods.length - 1)];

  /* ---------- filtered days: period, then domain, then search ---------- */
  const filteredDays = useMemo(() => {
    let days = campaign.days;
    if (activePeriod) {
      days = days.filter((d) => d.day >= activePeriod.start && d.day <= activePeriod.end);
    }
    if (domainFilter) {
      days = days.filter((d) => d.domains.includes(domainFilter));
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      days = days.filter((d) =>
        d.topics.some((t) => t.toLowerCase().includes(q)) ||
        String(d.day).includes(q) ||
        (notes[d.id] || "").toLowerCase().includes(q)
      );
    }
    return days;
  }, [campaign, domainFilter, query, activePeriod, notes]);

  /* ---------- related-days index (per campaign) ---------- */
  const relatedIndex = useMemo(() => buildRelatedIndex(campaign.days), [campaign]);
  const getRelated = useCallback(
    (day) => relatedDaysFor(day, campaign.days, relatedIndex, 3),
    [campaign, relatedIndex]
  );

  /* ---------- review queue ---------- */
  const now = Date.now();
  const reviewQueue = useMemo(() => {
    const all = [...CAMPAIGNS.main.days, ...CAMPAIGNS.sprint.days];
    return dueList(srs, all, Date.now());
  }, [srs]);

  const scheduledCount = useMemo(
    () => Object.values(srs).filter((e) => e && !e.graduated).length,
    [srs]
  );

  return (
    <ThemeCtx.Provider value={{ theme, domainColors }}>
    <div className={classNames("app-root", theme.mode === "light" && "is-light", !theme.effects && "no-fx")} style={themeVars(theme)}>
      <style>{CSS}</style>
      <BackgroundFX accent={campaign.accent} effects={theme.effects} />
      <TopBar
        stats={globalStats}
        onOpenData={() => setModal({ kind: "export" })}
        themeKey={themeKey}
        setThemeKey={setThemeKey}
        saveStatus={saveStatus}
        noteCount={Object.keys(notes).length}
        confirmReset={confirmReset}
        setConfirmReset={setConfirmReset}
        onReset={handleReset}
      />
      <CampaignSwitcher
        active={activeCampaign}
        setActive={setActiveCampaign}
        campaignStats={campaignStats}
        campaigns={themedCampaigns}
      />
      <CampaignHero campaign={campaign} stats={campaignStats[campaign.key]} />
      <ViewTabs view={view} setView={setView} dueCount={reviewQueue.length} />

      {(view === "console" || view === "grid") && (
      <PeriodNav
        scopes={scopesFor(campaign.key)}
        scope={scope}
        setScope={setScope}
        periods={periods}
        periodIdx={periodIdx}
        setPeriodIdx={setPeriodIdx}
        accent={campaign.accent}
        activeDayNum={activeDayNum}
      />
      )}

      {(view === "console" || view === "grid") && (
      <div className="controls-row">
        <div className="search-wrap">
          <Icon.Search size={15} />
          <input
            className="search-input"
            placeholder={`Search ${campaign.totalDays} days of topics…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <DomainLegend
          tally={campaignStats[campaign.key].domainTally}
          active={domainFilter}
          setActive={setDomainFilter}
          accent={campaign.accent}
        />
      </div>
      )}

      {view === "console" && (
        <ConsoleView
          campaign={campaign}
          days={filteredDays}
          progress={progress}
          onToggle={handleToggleTopic}
          expandedDay={expandedDay}
          setExpandedDay={setExpandedDay}
          topicsDoneCount={topicsDoneCount}
          isDayComplete={isDayComplete}
          jumpTarget={campaignStats[campaign.key].activeDay}
          notes={notes}
          setNote={setNote}
          getRelated={getRelated}
          refs={refs}
          setRef={setRef}
          onJumpDay={(d) => { setExpandedDay(d.id); setScope("all"); }}
          onOpenTool={(kind, day) => setModal({ kind, day })}
          query={query}
        />
      )}
      {view === "grid" && (
        <GridView
          campaign={campaign}
          days={filteredDays}
          progress={progress}
          isDayComplete={isDayComplete}
          topicsDoneCount={topicsDoneCount}
          notes={notes}
          onOpenDay={(d) => { setExpandedDay(d.id); setView("console"); }}
        />
      )}
      {view === "review" && (
        <ReviewView
          queue={reviewQueue}
          srs={srs}
          notes={notes}
          scheduledCount={scheduledCount}
          onGrade={gradeReview}
          onOpenDay={(d) => {
            setActiveCampaign(d.id.startsWith("45") ? "sprint" : "main");
            setExpandedDay(d.id);
            setScope("all");
            setView("console");
          }}
        />
      )}
      {view === "weekly" && (
        <WeeklyView
          log={log}
          notes={notes}
          progress={progress}
          srs={srs}
          campaigns={themedCampaigns}
          activeCampaign={activeCampaign}
          onOpenDay={(d) => { setExpandedDay(d.id); setScope("all"); setView("console"); }}
          onExport={() => setModal({ kind: "export" })}
        />
      )}
      {view === "log" && (
        <LogView campaign={campaign} stats={campaignStats[campaign.key]} progress={progress} notes={notes} />
      )}

      {modal && (
        <ModalHost
          modal={modal}
          onClose={() => setModal(null)}
          notes={notes}
          refs={refs}
          setRef={setRef}
          appendNote={appendNote}
          progress={progress}
          srs={srs}
          log={log}
          themeKey={themeKey}
          onImport={applyImport}
          fireToast={fireToast}
        />
      )}

      <ToastLayer toast={toast} />
      {confetti && <ConfettiBurst key={confetti.id} color={confetti.color} />}
      <Footer />
    </div>
    </ThemeCtx.Provider>
  );
}

/* ============================== BACKGROUND FX ============================== */
function BackgroundFX({ accent, effects }) {
  return (
    <div className="bg-fx" aria-hidden="true">
      <div className="bg-grid" />
      <div
        className="bg-glow"
        style={{ background: `radial-gradient(620px circle at 20% 0%, ${hexToRgba(accent, effects ? 0.14 : 0.04)}, transparent 62%)` }}
      />
      <div className="bg-scanline" />
    </div>
  );
}

/* ============================== TOP BAR ============================== */
const SAVE_COPY = {
  loading: "Loading saved progress",
  idle: "Progress saved automatically",
  saving: "Saving",
  saved: "Saved",
  error: "Save failed - retrying on next change",
  off: "Storage unavailable - this session only",
};

function SaveIndicator({ status }) {
  const label = status === "saving" ? "Saving…"
    : status === "saved" ? "Saved"
    : status === "error" ? "Not saved"
    : status === "loading" ? "Loading…"
    : status === "off" ? "Session only"
    : "Autosaved";
  return (
    <div className={classNames("stat-chip", "save-chip", `save-${status}`)} title={SAVE_COPY[status]}>
      <span className="save-dot" />
      <span className="stat-chip-val">{label}</span>
    </div>
  );
}

function ThemePicker({ themeKey, setThemeKey }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = THEMES[themeKey];

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-wrap" ref={wrapRef}>
      <button
        className="stat-chip theme-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Change theme"
      >
        <span className="theme-swatches">
          {current.swatch.map((col, i) => (
            <span key={i} className="theme-sw" style={{ background: col }} />
          ))}
        </span>
        <span className="stat-chip-val">{current.name}</span>
        <Icon.Chevron size={12} className={classNames("theme-chev", open && "theme-chev-open")} />
      </button>
      {open && (
        <div className="theme-menu" role="listbox">
          {THEME_ORDER.map((k) => {
            const t = THEMES[k];
            const isOn = k === themeKey;
            return (
              <button
                key={k}
                role="option"
                aria-selected={isOn}
                className={classNames("theme-item", isOn && "theme-item-active")}
                onClick={() => { setThemeKey(k); setOpen(false); }}
              >
                <span className="theme-swatches">
                  {t.swatch.map((col, i) => (
                    <span key={i} className="theme-sw" style={{ background: col }} />
                  ))}
                </span>
                <span className="theme-item-name">{t.name}</span>
                {isOn && <Icon.Check size={12} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopBar({ stats, themeKey, setThemeKey, saveStatus, noteCount, confirmReset, setConfirmReset, onReset, onOpenData }) {
  const pct = stats.need ? Math.min(100, Math.round((stats.into / stats.need) * 100)) : 0;
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-text">DUAL<span className="brand-accent">TRACK</span></span>
        </div>
        <span className="brand-sub">learning ops console</span>
      </div>
      <div className="topbar-right">
        <button className="stat-chip data-btn" onClick={onOpenData} title="Export or import your data">
          <Icon.Download size={13} />
          <span className="stat-chip-val">Data</span>
        </button>
        <ThemePicker themeKey={themeKey} setThemeKey={setThemeKey} />
        <SaveIndicator status={saveStatus} />
        {noteCount > 0 && (
          <div className="stat-chip" title={`${noteCount} ${noteCount === 1 ? "day has" : "days have"} notes`}>
            <Icon.Note size={13} />
            <span className="stat-chip-val">{noteCount}</span>
          </div>
        )}
        <div className="stat-chip">
          <Icon.Trophy size={14} />
          <span className="stat-chip-label">RANK</span>
          <span className="stat-chip-val">{stats.rank}</span>
        </div>
        <div className="stat-chip level-chip">
          <span className="level-badge">LV {stats.level}</span>
          <div className="xp-bar-mini">
            <div className="xp-bar-mini-fill" style={{ width: pct + "%" }} />
          </div>
          <span className="stat-chip-val">{stats.into}/{stats.need} XP</span>
        </div>
        <div className="stat-chip">
          <Icon.Bolt size={14} />
          <span className="stat-chip-val">{stats.xp.toLocaleString()} XP</span>
        </div>
        {confirmReset ? (
          <div className="reset-confirm">
            <span>Erase all progress and notes?</span>
            <button className="reset-yes" onClick={onReset}>Erase</button>
            <button className="reset-no" onClick={() => setConfirmReset(false)}>Keep</button>
          </div>
        ) : (
          <button className="stat-chip reset-btn" onClick={() => setConfirmReset(true)} title="Reset all progress and notes">
            <Icon.Rotate size={13} />
          </button>
        )}
      </div>
    </header>
  );
}

/* ============================== CAMPAIGN SWITCHER ============================== */
function CampaignSwitcher({ active, setActive, campaignStats, campaigns }) {
  return (
    <div className="switcher">
      {Object.values(campaigns).map((c) => {
        const st = campaignStats[c.key];
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            className={classNames("switcher-tab", isActive && "switcher-tab-active")}
            style={isActive ? { "--accent": c.accent, "--glow": c.glow } : undefined}
            onClick={() => setActive(c.key)}
          >
            <div className="switcher-tab-top">
              <span className="switcher-dot" style={{ background: c.accent }} />
              <span className="switcher-name">{c.name}</span>
            </div>
            <div className="switcher-sub">{c.subtitle}</div>
            <div className="switcher-progress-track">
              <div className="switcher-progress-fill" style={{ width: st.pct + "%", background: c.accent }} />
            </div>
            <div className="switcher-meta">
              <span>{st.daysComplete}/{st.totalDays} days</span>
              <span>{st.pct}%</span>
              {st.streak > 0 && (
                <span className="switcher-streak"><Icon.Flame size={11} />{st.streak}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================== CAMPAIGN HERO ============================== */
function CampaignHero({ campaign, stats }) {
  const activeDay = stats.activeDay;
  return (
    <div className="hero" style={{ "--accent": campaign.accent, "--glow": campaign.glow }}>
      <div className="hero-left">
        <div className="hero-eyebrow">ACTIVE CAMPAIGN</div>
        <h1 className="hero-title">{campaign.name}</h1>
        <p className="hero-sub">{campaign.subtitle}</p>
        <div className="hero-ring-row">
          <ProgressRing pct={stats.pct} accent={campaign.accent} />
          <div className="hero-metrics">
            <Metric label="Days Complete" value={`${stats.daysComplete} / ${stats.totalDays}`} />
            <Metric label="Topics Mastered" value={`${stats.doneTopics} / ${stats.totalTopics}`} />
            <Metric label="Current Streak" value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`} icon={stats.streak > 0 ? <Icon.Flame size={14} /> : null} />
          </div>
        </div>
      </div>
      {activeDay && (
        <div className="hero-right">
          <div className="next-mission-label">
            <Icon.Target size={13} /> NEXT MISSION
          </div>
          <div className="next-mission-card">
            <div className="next-mission-day">DAY {activeDay.day}</div>
            <ul className="next-mission-topics">
              {activeDay.topics.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="metric">
      <div className="metric-value">{icon}{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}

function ProgressRing({ pct, accent }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="progress-ring-wrap">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle
          cx="52" cy="52" r={r} fill="none" stroke={accent} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 52 52)"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div className="progress-ring-label">{pct}%</div>
    </div>
  );
}

/* ============================== VIEW TABS ============================== */
function ViewTabs({ view, setView, dueCount }) {
  const tabs = [
    { key: "console", label: "Console", icon: Icon.Terminal },
    { key: "grid", label: "Grid", icon: Icon.Grid },
    { key: "review", label: "Review", icon: Icon.Rotate, badge: dueCount },
    { key: "weekly", label: "Weekly", icon: Icon.Calendar },
    { key: "log", label: "Analytics", icon: Icon.List },
  ];
  return (
    <div className="view-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={classNames("view-tab", view === t.key && "view-tab-active")}
          onClick={() => setView(t.key)}
        >
          <t.icon size={13} /> {t.label}
          {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

/* ============================== PERIOD NAV ============================== */
function PeriodNav({ scopes, scope, setScope, periods, periodIdx, setPeriodIdx, accent, activeDayNum }) {
  const stripRef = useRef(null);

  useEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current.querySelector('[data-period-active="true"]');
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest", inline: "center" });
  }, [periodIdx, scope]);

  return (
    <div className="period-nav" style={{ "--accent": accent }}>
      <div className="scope-row">
        {scopes.map((sc) => (
          <button
            key={sc.key}
            className={classNames("scope-btn", scope === sc.key && "scope-btn-active")}
            onClick={() => setScope(sc.key)}
          >
            {sc.label}
          </button>
        ))}
        {periods && (
          <div className="period-summary">
            {periods[Math.min(periodIdx, periods.length - 1)].done}/{periods[Math.min(periodIdx, periods.length - 1)].total} topics
            <span className="period-summary-sep">·</span>
            {periods[Math.min(periodIdx, periods.length - 1)].pct}%
          </div>
        )}
      </div>

      {periods && (
        <div className="period-strip" ref={stripRef}>
          {periods.map((p, i) => {
            const isActive = i === Math.min(periodIdx, periods.length - 1);
            const holdsCurrent = activeDayNum >= p.start && activeDayNum <= p.end;
            const complete = p.pct === 100;
            return (
              <button
                key={p.label + p.start}
                data-period-active={isActive ? "true" : "false"}
                className={classNames("period-chip", isActive && "period-chip-active", complete && "period-chip-complete")}
                onClick={() => setPeriodIdx(i)}
              >
                <div className="period-chip-top">
                  <span className="period-chip-label">{p.label}</span>
                  {holdsCurrent && <span className="period-here" title="Your current day is here" />}
                </div>
                <div className="period-chip-sub">{p.sub}</div>
                <div className="period-chip-track">
                  <div className="period-chip-fill" style={{ width: p.pct + "%" }} />
                </div>
                <div className="period-chip-meta">
                  <span>{p.start}-{p.end}</span>
                  <span>{p.pct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================== DOMAIN LEGEND ============================== */
function DomainLegend({ tally, active, setActive, accent }) {
  const { domainColors } = useContext(ThemeCtx);
  const domains = Object.keys(DOMAIN_META).filter((k) => tally[k]);
  return (
    <div className="domain-legend">
      {domains.map((k) => {
        const meta = DOMAIN_META[k];
        const color = domainColors[k];
        const t = tally[k];
        const pct = t ? Math.round((t.done / t.total) * 100) : 0;
        const isActive = active === k;
        return (
          <button
            key={k}
            className={classNames("domain-chip", isActive && "domain-chip-active")}
            style={{ "--dot": color, borderColor: isActive ? color : undefined }}
            onClick={() => setActive(isActive ? null : k)}
            title={`${t.done}/${t.total} complete`}
          >
            <span className="domain-chip-dot" />
            {meta.label}
            <span className="domain-chip-pct">{pct}%</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================== CONSOLE VIEW ============================== */
function ConsoleView({ campaign, days, progress, onToggle, expandedDay, setExpandedDay, topicsDoneCount, isDayComplete, jumpTarget, notes, setNote, getRelated, onJumpDay, onOpenTool, query, refs, setRef }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (jumpTarget && listRef.current) {
      const el = listRef.current.querySelector(`[data-day-id="${jumpTarget.id}"]`);
      if (el) el.scrollIntoView({ block: "center" });
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div className="console-view" ref={listRef}>
      {days.length === 0 && <EmptyState />}
      {days.map((day) => {
        const done = topicsDoneCount(day);
        const complete = isDayComplete(day);
        const isExpanded = expandedDay === day.id;
        const isCurrent = jumpTarget && jumpTarget.id === day.id;
        return (
          <div
            key={day.id}
            data-day-id={day.id}
            className={classNames(
              "day-row",
              complete && "day-row-complete",
              isExpanded && "day-row-expanded",
              isCurrent && !complete && "day-row-current"
            )}
            style={{ "--accent": campaign.accent }}
          >
            <button
              className="day-row-header"
              onClick={() => setExpandedDay(isExpanded ? null : day.id)}
            >
              <span className="day-num">
                {complete ? <Icon.Check size={13} /> : <span className="day-num-text">{String(day.day).padStart(3, "0")}</span>}
              </span>
              <span className="day-row-topics-preview">
                {day.topics.map((t, i) => (
                  <span key={i} className={classNames("topic-chip-mini", progress[day.id] && progress[day.id][i] && "topic-chip-mini-done")}>
                    <DomainDot domain={day.domains[i]} />
                    {t}
                  </span>
                ))}
              </span>
              <span className="day-row-right">
                {query && query.trim() && (notes[day.id] || "").toLowerCase().includes(query.trim().toLowerCase()) && (
                  <span className="note-match" title="Matched inside your notes">note</span>
                )}
                {notes[day.id] && (
                  <span className="note-flag" title="This day has notes"><Icon.Note size={12} /></span>
                )}
                {isCurrent && !complete && <span className="current-pill">CURRENT</span>}
                <span className="day-row-frac">{done}/{day.topics.length}</span>
                <Icon.Chevron size={14} className={classNames("chev", isExpanded && "chev-open")} />
              </span>
            </button>
            {isExpanded && (
              <div className="day-row-body">
                {day.topics.map((t, i) => {
                  const isDone = !!(progress[day.id] && progress[day.id][i]);
                  return (
                    <label key={i} className={classNames("topic-line", isDone && "topic-line-done")}>
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => onToggle(day, i, campaign)}
                      />
                      <span className="topic-checkbox">
                        {isDone && <Icon.Check size={11} />}
                      </span>
                      <span className="topic-text">{t}</span>
                      <DomainTag domain={day.domains[i]} />
                    </label>
                  );
                })}
                <NoteEditor
                  value={notes[day.id] || ""}
                  onChange={(v) => setNote(day.id, v)}
                  dayNum={day.day}
                />
                <div className="day-tools">
                  <button className="tool-btn" onClick={() => onOpenTool("quiz", day)}>
                    <Icon.Target size={12} /> Quiz me
                  </button>
                  <button className="tool-btn" onClick={() => onOpenTool("notes", day)}>
                    <Icon.Book size={12} /> Generate notes
                  </button>
                  <button className="tool-btn" onClick={() => onOpenTool("linkedin", day)}>
                    <Icon.Send size={12} /> Draft post
                  </button>
                </div>
                <ReferenceBlock
                  data={refs[day.id]}
                  onClear={() => setRef(day.id, null)}
                  onRegenerate={() => onOpenTool("notes", day)}
                />
                <RelatedDays related={getRelated(day)} onJump={onJumpDay} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NoteEditor({ value, onChange, dayNum }) {
  const taRef = useRef(null);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(64, el.scrollHeight) + "px";
  }, [value]);

  return (
    <div className="note-block">
      <div className="note-head">
        <span className="note-label"><Icon.Note size={12} /> Day {dayNum} notes</span>
        {value.trim().length > 0 && (
          <span className="note-count">{value.trim().split(/\s+/).length} words</span>
        )}
      </div>
      <textarea
        ref={taRef}
        className="note-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What clicked, what didn't. Links, gotchas, code to revisit, questions for your team…"
        spellCheck="true"
      />
    </div>
  );
}

function RelatedDays({ related, onJump }) {
  if (!related || related.length === 0) return null;
  return (
    <div className="related-block">
      <div className="related-label">Builds on / connects to</div>
      <div className="related-row">
        {related.map(({ day, terms }) => (
          <button key={day.id} className="related-chip" onClick={() => onJump(day)}>
            <span className="related-day">Day {day.day}</span>
            <span className="related-topics">{day.topics.join(" · ")}</span>
            {terms && terms.length > 0 && (
              <span className="related-terms">shares: {terms.join(", ")}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function useDomainColor(domain) {
  const { domainColors } = useContext(ThemeCtx);
  return domainColors[domain] || domainColors["systems-eng"];
}

function DomainDot({ domain }) {
  const color = useDomainColor(domain);
  return <span className="domain-dot" style={{ background: color }} />;
}

function DomainTag({ domain }) {
  const color = useDomainColor(domain);
  const meta = DOMAIN_META[domain] || DOMAIN_META["systems-eng"];
  return (
    <span className="domain-tag" style={{ color, borderColor: hexToRgba(color, 0.4), background: hexToRgba(color, 0.09) }}>
      {meta.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Icon.Search size={28} />
      <div className="empty-state-title">No matching transmissions</div>
      <div className="empty-state-sub">Try a different search term or clear the domain filter.</div>
    </div>
  );
}

/* ============================== GRID VIEW (heatmap / signature element) ============================== */
function GridView({ campaign, days, progress, isDayComplete, topicsDoneCount, notes, onOpenDay }) {
  return (
    <div className="grid-view">
      <div className="grid-view-caption">
        Each cell is one day · color = completion · corner mark = has notes · click to open
      </div>
      <div className="heatmap">
        {days.map((day) => {
          const done = topicsDoneCount(day);
          const complete = isDayComplete(day);
          const level = done === 0 ? 0 : done === day.topics.length ? 2 : 1;
          return (
            <button
              key={day.id}
              className={classNames("heat-cell", `heat-level-${level}`)}
              style={{ "--accent": campaign.accent }}
              onClick={() => onOpenDay(day)}
              title={`Day ${day.day}: ${day.topics.join(" · ")}${notes[day.id] ? " — has notes" : ""}`}
            >
              <span className="heat-cell-num">{day.day}</span>
              {complete && <span className="heat-cell-check"><Icon.Check size={9} /></span>}
              {notes[day.id] && <span className="heat-cell-note" />}
            </button>
          );
        })}
      </div>
      <div className="heat-legend">
        <span>Less</span>
        <span className="heat-cell heat-level-0 heat-legend-swatch" style={{ "--accent": campaign.accent }} />
        <span className="heat-cell heat-level-1 heat-legend-swatch" style={{ "--accent": campaign.accent }} />
        <span className="heat-cell heat-level-2 heat-legend-swatch" style={{ "--accent": campaign.accent }} />
        <span>More</span>
      </div>
    </div>
  );
}

/* ============================== REVIEW VIEW (spaced repetition) ============================== */
function ReviewView({ queue, srs, notes, scheduledCount, onGrade, onOpenDay }) {
  const [revealed, setRevealed] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => { setRevealed(false); }, [cursor, queue.length]);

  if (queue.length === 0) {
    const upcoming = Object.entries(srs)
      .filter(([, e]) => e && !e.graduated && e.due)
      .sort((a, b) => a[1].due - b[1].due)[0];
    const graduated = Object.values(srs).filter((e) => e && e.graduated).length;
    return (
      <div className="review-view">
        <div className="review-empty">
          <Icon.Check size={26} />
          <div className="review-empty-title">Nothing due right now</div>
          <div className="review-empty-sub">
            {scheduledCount > 0
              ? `${scheduledCount} ${scheduledCount === 1 ? "day is" : "days are"} scheduled. Next one ${upcoming ? relativeDue(upcoming[1].due, Date.now()) : "soon"}.`
              : "Complete a day in the console and it enters the review queue after 7 days."}
          </div>
          {graduated > 0 && <div className="review-empty-sub">{graduated} fully retained.</div>}
        </div>
      </div>
    );
  }

  const idx = Math.min(cursor, queue.length - 1);
  const { day, entry } = queue[idx];
  const note = notes[day.id];

  const grade = (outcome) => {
    onGrade(day.id, outcome);
    setRevealed(false);
    setCursor((c) => (c >= queue.length - 1 ? 0 : c));
  };

  return (
    <div className="review-view">
      <div className="review-head">
        <span className="review-count">{queue.length} due</span>
        <span className="review-meta">
          Day {day.day} · reviewed {entry.reps} {entry.reps === 1 ? "time" : "times"} · interval {SRS_INTERVALS[entry.idx]}d
        </span>
      </div>

      <div className="review-card">
        <div className="review-prompt">Can you still explain these without looking?</div>
        <ul className="review-topics">
          {day.topics.map((t, i) => <li key={i}>{t}</li>)}
        </ul>

        {!revealed ? (
          <button className="reveal-btn" onClick={() => setRevealed(true)}>
            {note ? "Show my notes" : "I have thought it through"}
          </button>
        ) : (
          <div className="review-note">
            {note
              ? <pre className="review-note-text">{note}</pre>
              : <div className="review-note-empty">No notes saved for this day. Open it to add some.</div>}
            <button className="review-open-link" onClick={() => onOpenDay(day)}>Open Day {day.day} →</button>
          </div>
        )}
      </div>

      <div className="grade-row">
        <button className="grade-btn grade-forgot" onClick={() => grade("forgot")}>
          Forgot <span className="grade-sub">back in 3d</span>
        </button>
        <button className="grade-btn grade-shaky" onClick={() => grade("shaky")}>
          Shaky <span className="grade-sub">repeat {SRS_INTERVALS[entry.idx]}d</span>
        </button>
        <button className="grade-btn grade-solid" onClick={() => grade("solid")}>
          Solid <span className="grade-sub">
            {entry.idx + 1 >= SRS_INTERVALS.length ? "retained" : `next ${SRS_INTERVALS[entry.idx + 1]}d`}
          </span>
        </button>
      </div>

      {queue.length > 1 && (
        <button className="skip-btn" onClick={() => setCursor((c) => (c + 1) % queue.length)}>
          Skip for now
        </button>
      )}
    </div>
  );
}

/* ============================== WEEKLY REVIEW VIEW ============================== */
function WeeklyView({ log, notes, progress, srs, campaigns, activeCampaign, onOpenDay, onExport }) {
  const { domainColors } = useContext(ThemeCtx);
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;

  const allDays = useMemo(
    () => [...CAMPAIGNS.main.days, ...CAMPAIGNS.sprint.days],
    []
  );
  const dayById = useMemo(() => {
    const m = {};
    allDays.forEach((d) => { m[d.id] = d; });
    return m;
  }, [allDays]);

  const weekEvents = useMemo(() => log.filter((e) => e.at >= weekAgo), [log, weekAgo]);

  const domainTally = useMemo(() => {
    const t = {};
    weekEvents.forEach((e) => {
      const d = dayById[e.d];
      if (!d) return;
      const dom = d.domains[e.i];
      t[dom] = (t[dom] || 0) + 1;
    });
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [weekEvents, dayById]);

  const activeDayStreak = useMemo(() => {
    if (log.length === 0) return 0;
    const days = new Set(log.map((e) => new Date(e.at).toDateString()));
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const d = new Date(now - i * DAY_MS).toDateString();
      if (days.has(d)) streak += 1;
      else if (i > 0) break;
    }
    return streak;
  }, [log, now]);

  const openQuestions = useMemo(() => {
    const out = [];
    Object.entries(notes).forEach(([id, text]) => {
      if (!text) return;
      text.split("\n").forEach((line) => {
        const l = line.trim();
        if (!l) return;
        if (l.includes("?") || /\bTODO\b/i.test(l) || /\bFIXME\b/i.test(l)) {
          out.push({ id, line: l });
        }
      });
    });
    return out.slice(0, 12);
  }, [notes]);

  const campaign = campaigns[activeCampaign];
  const upcoming = useMemo(() => {
    const done = (d) => {
      const p = progress[d.id];
      return p && d.topics.every((_, i) => p[i]);
    };
    return campaign.days.filter((d) => !done(d)).slice(0, 5);
  }, [campaign, progress]);

  const dueNow = useMemo(() => dueList(srs, allDays, now).length, [srs, allDays, now]);

  const byDay = useMemo(() => {
    const buckets = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now - i * DAY_MS);
      const key = start.toDateString();
      const label = start.toLocaleDateString(undefined, { weekday: "short" });
      buckets.push({ key, label, count: weekEvents.filter((e) => new Date(e.at).toDateString() === key).length });
    }
    return buckets;
  }, [weekEvents, now]);

  const maxCount = Math.max(1, ...byDay.map((b) => b.count));

  return (
    <div className="weekly-view">
      <div className="weekly-strip">
        <SummaryCard label="Topics This Week" value={weekEvents.length} sub="last 7 days" accent={campaign.accent} />
        <SummaryCard label="Active Day Streak" value={activeDayStreak} sub={activeDayStreak === 1 ? "day" : "days"} accent={campaign.accent} />
        <SummaryCard label="Due For Review" value={dueNow} sub="in the queue" accent={campaign.accent} />
        <SummaryCard label="Open Questions" value={openQuestions.length} sub="flagged in notes" accent={campaign.accent} />
      </div>

      <div className="weekly-grid">
        <div className="log-panel">
          <div className="log-panel-title">LAST 7 DAYS</div>
          <div className="week-bars">
            {byDay.map((b) => (
              <div key={b.key} className="week-bar-col">
                <div className="week-bar-wrap">
                  <div
                    className="week-bar"
                    style={{ height: Math.round((b.count / maxCount) * 100) + "%", background: campaign.accent, opacity: b.count ? 1 : 0.18 }}
                  />
                </div>
                <div className="week-bar-num">{b.count}</div>
                <div className="week-bar-label">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="log-panel">
          <div className="log-panel-title">DOMAINS TOUCHED</div>
          <div className="log-panel-body">
            {domainTally.length === 0 && <div className="weekly-empty">Nothing completed in the last 7 days.</div>}
            {domainTally.map(([dom, count]) => {
              const meta = DOMAIN_META[dom] || DOMAIN_META["systems-eng"];
              const color = domainColors[dom] || domainColors["systems-eng"];
              const pct = Math.round((count / weekEvents.length) * 100);
              return (
                <div key={dom} className="log-bar-row">
                  <span className="log-bar-label" style={{ color }}>{meta.label}</span>
                  <div className="log-bar-track">
                    <div className="log-bar-fill" style={{ width: pct + "%", background: color }} />
                  </div>
                  <span className="log-bar-val">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="weekly-grid">
        <div className="log-panel">
          <div className="log-panel-title">OPEN QUESTIONS IN YOUR NOTES</div>
          <div className="log-panel-body">
            {openQuestions.length === 0 && (
              <div className="weekly-empty">Nothing flagged. Lines with a question mark or TODO show up here.</div>
            )}
            {openQuestions.map((q, i) => (
              <button key={i} className="question-row" onClick={() => dayById[q.id] && onOpenDay(dayById[q.id])}>
                <span className="question-day">Day {dayById[q.id] ? dayById[q.id].day : "?"}</span>
                <span className="question-text">{q.line}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="log-panel">
          <div className="log-panel-title">NEXT UP IN {campaign.name}</div>
          <div className="log-panel-body">
            {upcoming.length === 0 && <div className="weekly-empty">Campaign complete.</div>}
            {upcoming.map((d) => (
              <button key={d.id} className="question-row" onClick={() => onOpenDay(d)}>
                <span className="question-day">Day {d.day}</span>
                <span className="question-text">{d.topics.join(" · ")}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="weekly-footer">
        <button className="tool-btn" onClick={onExport}><Icon.Download size={12} /> Export notes and backup</button>
      </div>
    </div>
  );
}

/* ============================== LOG / ANALYTICS VIEW ============================== */
function LogView({ campaign, stats, progress, notes }) {
  const { domainColors } = useContext(ThemeCtx);
  const domainRows = Object.entries(stats.domainTally)
    .sort((a, b) => b[1].total - a[1].total);

  // Bucket by the roadmap's real section boundaries
  const isMain = campaign.key === "main";
  const buckets = useMemo(() => {
    const defs = isMain ? MONTHS_365 : WEEKS_45;
    return defs.map((def) => {
      let total = 0, done = 0;
      for (const d of campaign.days) {
        if (d.day < def.start || d.day > def.end) continue;
        const p = progress[d.id];
        total += d.topics.length;
        d.topics.forEach((_, i) => { if (p && p[i]) done += 1; });
      }
      return { label: def.label, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    });
  }, [campaign, progress, isMain]);

  return (
    <div className="log-view">
      <div className="log-grid">
        <div className="log-panel">
          <div className="log-panel-title">DOMAIN COVERAGE</div>
          <div className="log-panel-body">
            {domainRows.map(([dom, t]) => {
              const meta = DOMAIN_META[dom] || DOMAIN_META["systems-eng"];
              const color = domainColors[dom] || domainColors["systems-eng"];
              const pct = Math.round((t.done / t.total) * 100);
              return (
                <div key={dom} className="log-bar-row">
                  <span className="log-bar-label" style={{ color }}>{meta.label}</span>
                  <div className="log-bar-track">
                    <div className="log-bar-fill" style={{ width: pct + "%", background: color }} />
                  </div>
                  <span className="log-bar-val">{t.done}/{t.total}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="log-panel">
          <div className="log-panel-title">{isMain ? "MONTHLY VELOCITY" : "WEEKLY VELOCITY"}</div>
          <div className="log-panel-body">
            {buckets.map((b) => (
              <div key={b.label} className="log-bar-row">
                <span className="log-bar-label log-bar-label-mono">{b.label}</span>
                <div className="log-bar-track">
                  <div className="log-bar-fill" style={{ width: b.pct + "%", background: campaign.accent }} />
                </div>
                <span className="log-bar-val">{b.done}/{b.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="log-summary-strip">
        <SummaryCard label="Topics Mastered" value={stats.doneTopics} sub={`of ${stats.totalTopics}`} accent={campaign.accent} />
        <SummaryCard label="Days Fully Cleared" value={stats.daysComplete} sub={`of ${stats.totalDays}`} accent={campaign.accent} />
        <SummaryCard label="Completion" value={`${stats.pct}%`} sub="overall" accent={campaign.accent} />
        <SummaryCard label="Days With Notes" value={campaign.days.filter((d) => notes[d.id]).length} sub={`streak ${stats.streak}`} accent={campaign.accent} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className="summary-card" style={{ "--accent": accent }}>
      <div className="summary-card-value">{value}</div>
      <div className="summary-card-label">{label}</div>
      <div className="summary-card-sub">{sub}</div>
    </div>
  );
}

/* ============================== MARKDOWN EXPORT ============================== */
function buildMarkdown(progress, notes, srs, refs) {
  const now = new Date();
  const lines = [];
  lines.push("# DualTrack export");
  lines.push("");
  lines.push(`Exported ${now.toISOString().slice(0, 10)}`);
  lines.push("");

  Object.values(CAMPAIGNS).forEach((c) => {
    let done = 0, total = 0, noteDays = 0;
    c.days.forEach((d) => {
      const p = progress[d.id];
      total += d.topics.length;
      d.topics.forEach((_, i) => { if (p && p[i]) done += 1; });
      if (notes[d.id]) noteDays += 1;
    });
    lines.push(`## ${c.name}`);
    lines.push("");
    lines.push(`${c.subtitle}`);
    lines.push("");
    lines.push(`Progress: ${done}/${total} topics · ${noteDays} days with notes`);
    lines.push("");

    c.days.forEach((d) => {
      const p = progress[d.id] || {};
      const note = notes[d.id];
      const anyDone = d.topics.some((_, i) => p[i]);
      if (!anyDone && !note) return;
      const allDone = d.topics.every((_, i) => p[i]);
      lines.push(`### Day ${d.day}${allDone ? " ✓" : ""}`);
      d.topics.forEach((t, i) => lines.push(`- [${p[i] ? "x" : " "}] ${t}`));
      const e = srs[d.id];
      if (e) {
        lines.push("");
        lines.push(e.graduated
          ? "_Review: retained_"
          : `_Review: ${e.reps} ${e.reps === 1 ? "pass" : "passes"}, next ${relativeDue(e.due, Date.now())}_`);
      }
      if (note) {
        lines.push("");
        lines.push(note.trim());
      }
      const ref = refs && refs[d.id];
      if (ref) {
        lines.push("");
        lines.push(`<details><summary>Reference notes on ${ref.topic}</summary>`);
        lines.push("");
        lines.push(ref.text.trim());
        lines.push("");
        lines.push("</details>");
      }
      lines.push("");
    });
  });
  return lines.join("\n");
}

/* ============================== MODALS ============================== */
function ModalHost({ modal, onClose, notes, refs, setRef, appendNote, progress, srs, log, themeKey, onImport, fireToast }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const titles = { quiz: "Recall check", linkedin: "Draft a post", export: "Data", notes: "Generate study notes" };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <span className="modal-title">
            {titles[modal.kind]}
            {modal.day ? ` · Day ${modal.day.day}` : ""}
          </span>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon.X size={15} /></button>
        </div>
        <div className="modal-body">
          {modal.kind === "notes" && (
            <NotesGenPanel
              day={modal.day}
              existing={refs[modal.day.id]}
              onSaveRef={(payload) => setRef(modal.day.id, payload)}
              onAppendNote={(text) => appendNote(modal.day.id, text)}
              fireToast={fireToast}
            />
          )}
          {modal.kind === "quiz" && <QuizPanel day={modal.day} note={notes[modal.day.id]} />}
          {modal.kind === "linkedin" && <LinkedInPanel day={modal.day} note={notes[modal.day.id]} fireToast={fireToast} />}
          {modal.kind === "export" && (
            <DataPanel progress={progress} notes={notes} refs={refs} srs={srs} log={log} themeKey={themeKey} onImport={onImport} fireToast={fireToast} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- minimal markdown renderer (headings, lists, code, inline) ---------- */
function inlineFormat(text, keyBase) {
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) parts.push(<code key={keyBase + "-c" + i}>{tok.slice(1, -1)}</code>);
    else parts.push(<strong key={keyBase + "-b" + i}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
    i += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function MiniMarkdown({ text }) {
  const blocks = useMemo(() => {
    const out = [];
    const re = /```(\w*)\n([\s\S]*?)```/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ type: "text", body: text.slice(last, m.index) });
      out.push({ type: "code", lang: m[1], body: m[2] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ type: "text", body: text.slice(last) });
    return out;
  }, [text]);

  return (
    <div className="md">
      {blocks.map((b, bi) => {
        if (b.type === "code") {
          return (
            <pre key={bi} className="md-pre">
              {b.lang && <span className="md-lang">{b.lang}</span>}
              <code>{b.body.replace(/\n$/, "")}</code>
            </pre>
          );
        }
        const lines = b.body.split("\n");
        const nodes = [];
        let list = [];
        const flush = (k) => {
          if (list.length) {
            nodes.push(<ul key={"ul" + k} className="md-ul">{list}</ul>);
            list = [];
          }
        };
        lines.forEach((raw, li) => {
          const line = raw.trimEnd();
          const key = bi + "-" + li;
          if (!line.trim()) { flush(key); return; }
          const h = line.match(/^(#{1,4})\s+(.*)$/);
          if (h) {
            flush(key);
            const lvl = Math.min(h[1].length, 4);
            nodes.push(<div key={key} className={"md-h md-h" + lvl}>{inlineFormat(h[2], key)}</div>);
            return;
          }
          const li2 = line.match(/^\s*[-*]\s+(.*)$/);
          if (li2) { list.push(<li key={key}>{inlineFormat(li2[1], key)}</li>); return; }
          const num = line.match(/^\s*\d+\.\s+(.*)$/);
          if (num) { list.push(<li key={key}>{inlineFormat(num[1], key)}</li>); return; }
          flush(key);
          nodes.push(<p key={key} className="md-p">{inlineFormat(line, key)}</p>);
        });
        flush("end" + bi);
        return <div key={bi}>{nodes}</div>;
      })}
    </div>
  );
}

/* ---------- notes generator ---------- */
const NOTE_STYLES = [
  { key: "explainer", label: "Explainer", hint: "Concepts plus one worked example" },
  { key: "code", label: "Code first", hint: "Heavy on annotated code" },
  { key: "failure", label: "Failure modes", hint: "What breaks in production" },
];

function NotesGenPanel({ day, existing, onSaveRef, onAppendNote, fireToast }) {
  const [topicIdx, setTopicIdx] = useState(0);
  const [style, setStyle] = useState("explainer");
  const [state, setState] = useState(existing ? "ready" : "idle");
  const [text, setText] = useState(existing ? existing.text : "");
  const [err, setErr] = useState("");

  const styleBrief = {
    explainer: "Lead with the mental model, then one worked example, then the gotchas that bite people. Balance prose and example.",
    code: "Minimise prose. Centre the notes on annotated, realistic code the reader could actually run or adapt. Comment the lines that carry the insight.",
    failure: "Centre the notes on production failure modes: what goes wrong, the symptoms you would actually observe, how to diagnose it, and how to prevent it.",
  };

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const topic = day.topics[topicIdx];
      const prompt = `Write compact study notes on this topic for an experienced full stack engineer who works in TypeScript, Node.js and NestJS on AWS, with React on the front end. They already know the fundamentals, so skip introductory definitions and go straight to the substance.

Topic: ${topic}

Style: ${styleBrief[style]}

Requirements:
- Use concrete examples. Where the topic is code-shaped, give real code in a fenced block with the language tag, using their stack (TypeScript, Node, NestJS, React, AWS SDK v3) whenever it fits naturally. Do not invent APIs.
- Where the topic is not code-shaped, such as a consensus protocol or an architectural trade-off, use a concrete worked scenario with real numbers, a short trace of events, or a plain-text diagram instead of forcing code.
- Include at least one specific gotcha or misconception that trips up competent engineers.
- Use markdown with short section headings and bullet lists. Keep the whole thing under 700 words so it reads in about ten minutes.
- No preamble, no restating the topic name as a title, no closing summary. Start directly with the first section.`;
      const raw = await callClaude(prompt, 2000);
      setText(raw);
      setState("ready");
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setState("error");
    }
  };

  const save = () => {
    onSaveRef({ text, topic: day.topics[topicIdx], style, at: Date.now() });
    fireToast("Saved as reference material", "xp");
  };

  const doCopy = async () => {
    const ok = await copyText(text);
    fireToast(ok ? "Notes copied" : "Could not copy, select the text instead", "xp");
  };

  const toNotes = () => {
    onAppendNote(text);
    fireToast("Appended to your notes", "day");
  };

  return (
    <div className="notesgen">
      <div className="gen-field">
        <div className="gen-label">Topic</div>
        <div className="seg-row">
          {day.topics.map((t, i) => (
            <button
              key={i}
              className={classNames("seg-btn", topicIdx === i && "seg-btn-active")}
              onClick={() => setTopicIdx(i)}
              title={t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="gen-field">
        <div className="gen-label">Angle</div>
        <div className="seg-row">
          {NOTE_STYLES.map((sty) => (
            <button
              key={sty.key}
              className={classNames("seg-btn", style === sty.key && "seg-btn-active")}
              onClick={() => setStyle(sty.key)}
              title={sty.hint}
            >
              {sty.label}
            </button>
          ))}
        </div>
        <div className="gen-hint">{NOTE_STYLES.find((x) => x.key === style).hint}</div>
      </div>

      {state === "loading" && <div className="panel-loading">Writing notes with examples…</div>}
      {state === "error" && <div className="panel-error">Could not generate notes. {err}</div>}

      {(state === "idle" || state === "error") && (
        <button className="primary-btn" onClick={generate}>Generate notes</button>
      )}

      {state === "ready" && (
        <>
          <div className="gen-output"><MiniMarkdown text={text} /></div>
          <div className="panel-actions">
            <button className="primary-btn" onClick={save}>Save as reference</button>
            <button className="secondary-btn" onClick={toNotes}>Append to my notes</button>
            <button className="secondary-btn" onClick={doCopy}>Copy</button>
            <button className="secondary-btn" onClick={generate}>Regenerate</button>
          </div>
          <p className="gen-footnote">
            Saving keeps this separate from your own notes, so the review queue still tests what you wrote yourself.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- reference block shown inside a day ---------- */
function ReferenceBlock({ data, onClear, onRegenerate }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div className="ref-block">
      <button className="ref-head" onClick={() => setOpen((v) => !v)}>
        <Icon.Book size={12} />
        <span className="ref-title">Reference notes</span>
        <span className="ref-topic">{data.topic}</span>
        <Icon.Chevron size={13} className={classNames("chev", open && "chev-open")} />
      </button>
      {open && (
        <div className="ref-body">
          <MiniMarkdown text={data.text} />
          <div className="ref-actions">
            <button className="secondary-btn" onClick={onRegenerate}>Regenerate</button>
            <button className="secondary-btn" onClick={onClear}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizPanel({ day, note }) {
  const [state, setState] = useState("idle"); // idle | loading | ready | error
  const [questions, setQuestions] = useState([]);
  const [shown, setShown] = useState({});
  const [err, setErr] = useState("");

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const prompt = `You are helping a senior software engineer test their recall.

Topics studied:
1. ${day.topics[0]}
${day.topics[1] ? "2. " + day.topics[1] : ""}

${note ? "Their own notes:\n" + note.slice(0, 2500) : "They did not save notes."}

Write exactly 5 short recall questions that test genuine understanding of these topics at a senior engineer level. Favour "why" and "when would you" and trade-off questions over definitions. For each, give a concise 2-4 sentence model answer.

Respond with ONLY a JSON array, no preamble and no markdown fences:
[{"q":"question","a":"model answer"}]`;
      const raw = await callClaude(prompt, 1400);
      const parsed = JSON.parse(stripFences(raw));
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Unexpected format");
      setQuestions(parsed);
      setShown({});
      setState("ready");
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setState("error");
    }
  };

  if (state === "idle" || state === "error") {
    return (
      <div className="panel-intro">
        <p className="panel-copy">
          Answer out loud or on paper first, then reveal. Retrieval beats rereading.
        </p>
        {state === "error" && <div className="panel-error">Could not generate questions. {err}</div>}
        <button className="primary-btn" onClick={generate}>Generate 5 questions</button>
      </div>
    );
  }
  if (state === "loading") return <div className="panel-loading">Writing questions…</div>;

  return (
    <div className="quiz-list">
      {questions.map((q, i) => (
        <div key={i} className="quiz-item">
          <div className="quiz-q"><span className="quiz-num">{i + 1}</span>{q.q}</div>
          {shown[i]
            ? <div className="quiz-a">{q.a}</div>
            : <button className="quiz-reveal" onClick={() => setShown((s) => ({ ...s, [i]: true }))}>Reveal answer</button>}
        </div>
      ))}
      <button className="secondary-btn" onClick={generate}>New set</button>
    </div>
  );
}

function LinkedInPanel({ day, note, fireToast }) {
  const [state, setState] = useState("idle");
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");

  const generate = async () => {
    setState("loading");
    setErr("");
    try {
      const prompt = `Write a LinkedIn post for a software engineer who publishes educational technical content.

Topic studied today:
1. ${day.topics[0]}
${day.topics[1] ? "2. " + day.topics[1] : ""}

${note ? "Their own notes to draw from (use these as the substance):\n" + note.slice(0, 3000) : "No notes saved. Write from the topic titles at a senior engineer level."}

House style rules, follow all of them:
- Reads in 45 to 60 seconds. Short paragraphs, plenty of line breaks.
- Open with a strong hook line that creates curiosity or states a counter-intuitive truth.
- Use emojis sparingly as visual anchors for structure, not decoration.
- Never use em dashes anywhere in the post.
- Teach one concrete idea well rather than listing everything.
- End with a question that invites replies.
- Finish with exactly 3 targeted hashtags on their own line.
- Do not include any external links in the body. If a link would help, end with a line noting the link goes in the first comment.

Pick whichever of the two topics makes the better standalone post. Return only the post text, no commentary.`;
      const raw = await callClaude(prompt, 1200);
      setDraft(raw.replace(/—/g, ",").replace(/–/g, "-"));
      setState("ready");
    } catch (e) {
      setErr(e.message || "Something went wrong");
      setState("error");
    }
  };

  const doCopy = async () => {
    const ok = await copyText(draft);
    fireToast(ok ? "Draft copied" : "Could not copy, select the text instead", "xp");
  };

  if (state === "idle" || state === "error") {
    return (
      <div className="panel-intro">
        <p className="panel-copy">
          {note
            ? "Turns this day's notes into a post in your usual format."
            : "No notes on this day yet. The draft will come from the topic titles, so it will be thinner than usual."}
        </p>
        {state === "error" && <div className="panel-error">Could not write a draft. {err}</div>}
        <button className="primary-btn" onClick={generate}>Write draft</button>
      </div>
    );
  }
  if (state === "loading") return <div className="panel-loading">Drafting…</div>;

  return (
    <div className="draft-wrap">
      <textarea className="draft-text" value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} />
      <div className="panel-actions">
        <button className="primary-btn" onClick={doCopy}>Copy</button>
        <button className="secondary-btn" onClick={generate}>Rewrite</button>
      </div>
    </div>
  );
}

function DataPanel({ progress, notes, refs, srs, log, themeKey, onImport, fireToast, onClose }) {
  const [importErr, setImportErr] = useState("");
  const fileRef = useRef(null);

  const backup = () => JSON.stringify({ app: "dualtrack", version: 2, exportedAt: new Date().toISOString(), progress, notes, refs, srs, log, themeKey }, null, 2);

  const noteCount = Object.keys(notes).length;
  const doneCount = Object.values(progress).reduce((n, v) => n + Object.values(v).filter(Boolean).length, 0);

  const saveMd = async () => {
    const md = buildMarkdown(progress, notes, srs, refs);
    if (!downloadText("dualtrack-notes.md", md, "text/markdown")) {
      const ok = await copyText(md);
      fireToast(ok ? "Markdown copied to clipboard" : "Export failed", "xp");
    } else fireToast("Markdown exported", "xp");
  };

  const saveJson = async () => {
    const js = backup();
    if (!downloadText("dualtrack-backup.json", js, "application/json")) {
      const ok = await copyText(js);
      fireToast(ok ? "Backup copied to clipboard" : "Export failed", "xp");
    } else fireToast("Backup exported", "xp");
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(JSON.parse(String(reader.result)));
        fireToast("Backup restored", "day");
        onClose();
      } catch (err) {
        setImportErr(err.message || "That file could not be read");
      }
    };
    reader.onerror = () => setImportErr("That file could not be read");
    reader.readAsText(f);
  };

  return (
    <div className="data-panel">
      <div className="data-stat">{doneCount} topics complete · {noteCount} days with notes</div>

      <div className="data-section">
        <div className="data-section-title">Export</div>
        <p className="panel-copy">Markdown gives you a readable copy of every note. JSON is a full backup you can restore later.</p>
        <div className="panel-actions">
          <button className="primary-btn" onClick={saveMd}>Notes as markdown</button>
          <button className="secondary-btn" onClick={saveJson}>Full backup (JSON)</button>
        </div>
      </div>

      <div className="data-section">
        <div className="data-section-title">Restore</div>
        <p className="panel-copy">Loading a backup replaces everything currently in the app.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
        <button className="secondary-btn" onClick={() => fileRef.current && fileRef.current.click()}>Choose backup file</button>
        {importErr && <div className="panel-error">{importErr}</div>}
      </div>
    </div>
  );
}

/* ============================== TOAST + CONFETTI ============================== */
function ToastLayer({ toast }) {
  if (!toast) return null;
  return (
    <div key={toast.id} className={classNames("toast", toast.kind === "day" && "toast-day")}>
      {toast.kind === "day" ? <Icon.Trophy size={14} /> : <Icon.Bolt size={14} />}
      <span>{toast.msg}</span>
    </div>
  );
}

function ConfettiBurst({ color }) {
  const pieces = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.15,
    rot: Math.random() * 360,
    drift: (Math.random() - 0.5) * 120,
  })), []);
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left + "%",
            background: color,
            animationDelay: p.delay + "s",
            "--drift": p.drift + "px",
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/* ============================== FOOTER ============================== */
function Footer() {
  return (
    <footer className="app-footer">
      <span>DUALTRACK · two campaigns, one operator · progress and notes save automatically</span>
    </footer>
  );
}

/* ============================== STYLES ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; }

.app-root {
  position: relative;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  padding: 0 0 60px 0;
  overflow-x: hidden;
  transition: background 0.35s ease, color 0.35s ease;
}

/* ---------- background fx ---------- */
.bg-fx { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.bg-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
  background-size: var(--grid-size) var(--grid-size);
  mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 90%);
}
.bg-glow { position: absolute; inset: 0; transition: background 0.4s ease; }
.bg-scanline {
  position: absolute; inset: 0; opacity: var(--scan-op);
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px);
}

/* ---------- topbar ---------- */
.topbar {
  position: relative; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 28px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-blur);
  backdrop-filter: blur(12px);
  flex-wrap: wrap; gap: 12px;
}
.topbar-left { display: flex; align-items: baseline; gap: 10px; }
.brand { display: flex; align-items: center; gap: 7px; font-family: var(--display); font-weight: 700; font-size: 16px; letter-spacing: 0.3px; }
.brand-mark { color: var(--accent-main); font-size: 15px; }
.brand-accent { color: var(--accent-sprint); }
.brand-sub { font-family: var(--mono); font-size: 10.5px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 1.5px; }
.topbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.stat-chip {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 11.5px; color: var(--text-dim);
  background: var(--bg-panel); border: 1px solid var(--border);
  padding: 6px 11px; border-radius: var(--r-ctl);
}
.stat-chip-label { color: var(--text-faint); font-size: 10px; letter-spacing: 1px; }
.stat-chip-val { color: var(--text); font-weight: 600; }
.level-chip { gap: 8px; }
.level-badge {
  background: linear-gradient(135deg, var(--accent-main), var(--accent-sprint));
  color: var(--on-accent); font-weight: 700; font-size: 10.5px; padding: 2px 7px; border-radius: var(--r-bar); letter-spacing: 0.5px;
}
.xp-bar-mini { width: 60px; height: 5px; background: var(--track); border-radius: var(--r-bar); overflow: hidden; }
.xp-bar-mini-fill { height: 100%; background: linear-gradient(90deg, var(--accent-main), var(--accent-sprint)); transition: width 0.5s ease; }

/* ---------- theme picker ---------- */
.theme-wrap { position: relative; }
.theme-btn { cursor: pointer; gap: 8px; }
.theme-btn:hover { border-color: var(--border-hover); }
.theme-swatches { display: flex; gap: 2px; }
.theme-sw { width: 9px; height: 14px; border-radius: 2px; display: block; }
.theme-chev { color: var(--text-faint); transition: transform 0.2s ease; }
.theme-chev-open { transform: rotate(90deg); }
.theme-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 40;
  min-width: 190px; padding: 5px;
  background: var(--bg-panel); border: 1px solid var(--border-hover);
  border-radius: var(--r-card);
}
.theme-item {
  width: 100%; display: flex; align-items: center; gap: 9px;
  padding: 7px 9px; border-radius: var(--r-ctl); cursor: pointer;
  background: transparent; border: none; color: var(--text-dim);
  font-family: var(--sans); font-size: 12.5px; text-align: left;
}
.theme-item:hover { background: var(--bg-panel-2); color: var(--text); }
.theme-item-active { color: var(--text); }
.theme-item-name { flex: 1; }

/* ---------- save indicator ---------- */
.save-chip { gap: 7px; }
.save-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-faint); flex-shrink: 0; }
.save-idle .save-dot, .save-saved .save-dot { background: var(--ok); }
.save-saving .save-dot { background: var(--warn); animation: pulseDot 0.9s ease-in-out infinite; }
.save-loading .save-dot { background: var(--info); animation: pulseDot 0.9s ease-in-out infinite; }
.save-error .save-dot { background: var(--err); }
.save-off .save-dot { background: var(--text-faint); }
@keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.reset-btn { cursor: pointer; color: var(--text-faint); }
.reset-btn:hover { color: var(--err); border-color: var(--err); }
.reset-confirm {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--mono); font-size: 11px; color: var(--text-dim);
  background: var(--bg-panel); border: 1px solid var(--err); padding: 5px 10px; border-radius: var(--r-ctl);
}
.reset-yes, .reset-no {
  font-family: var(--mono); font-size: 10.5px; font-weight: 700; cursor: pointer;
  border-radius: var(--r-bar); padding: 3px 9px; border: 1px solid transparent;
}
.reset-yes { background: var(--err); color: var(--on-accent); }
.reset-no { background: transparent; border-color: var(--border); color: var(--text-dim); }
.reset-no:hover { color: var(--text); border-color: var(--border-hover); }

/* ---------- switcher ---------- */
.switcher {
  position: relative; z-index: 2;
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  padding: 20px 28px 0;
}
@media (max-width: 720px) { .switcher { grid-template-columns: 1fr; } }
.switcher-tab {
  text-align: left; cursor: pointer;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  padding: 16px 18px;
  color: var(--text-dim);
  transition: all 0.25s ease;
  font-family: var(--sans);
  position: relative; overflow: hidden;
}
.switcher-tab:hover { border-color: var(--border-hover); transform: translateY(-1px); }
.switcher-tab-active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, var(--bg-panel));
  box-shadow: 0 0 0 1px var(--accent) inset, 0 8px 24px -8px var(--glow);
}
.switcher-tab-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.switcher-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: var(--dot-glow); flex-shrink: 0; }
.switcher-name { font-family: var(--display); font-weight: 700; font-size: 13px; color: var(--text); letter-spacing: 0.3px; }
.switcher-sub { font-size: 12px; color: var(--text-dim); margin-bottom: 12px; }
.switcher-progress-track { height: 6px; background: var(--track); border-radius: var(--r-bar); overflow: hidden; margin-bottom: 8px; }
.switcher-progress-fill { height: 100%; border-radius: var(--r-bar); transition: width 0.5s ease; }
.switcher-meta { display: flex; align-items: center; gap: 12px; font-family: var(--mono); font-size: 11px; color: var(--text-faint); }
.switcher-streak { display: flex; align-items: center; gap: 3px; color: var(--accent-main); margin-left: auto; }

/* ---------- hero ---------- */
.hero {
  position: relative; z-index: 2;
  display: flex; justify-content: space-between; gap: 24px;
  padding: 28px 28px 8px; flex-wrap: wrap;
}
.hero-left { flex: 1 1 380px; min-width: 0; }
.hero-eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: var(--accent); font-weight: 700; margin-bottom: 6px; }
.hero-title { font-family: var(--display); font-size: clamp(24px, 4vw, 34px); font-weight: 700; margin: 0 0 4px; letter-spacing: 0.3px; }
.hero-sub { color: var(--text-dim); font-size: 14px; margin: 0 0 20px; }
.hero-ring-row { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; }
.progress-ring-wrap { position: relative; width: 104px; height: 104px; flex-shrink: 0; }
.progress-ring-label {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-weight: 800; font-size: 19px; color: var(--text);
}
.hero-metrics { display: flex; gap: 26px; flex-wrap: wrap; }
.metric-value { font-family: var(--mono); font-size: 19px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 5px; }
.metric-label { font-size: 11px; color: var(--text-faint); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
.hero-right { flex: 0 1 320px; min-width: 260px; }
.next-mission-label {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 11px; letter-spacing: 1.5px; color: var(--text-faint); margin-bottom: 8px;
}
.next-mission-card {
  background: var(--bg-panel-2); border: 1px solid var(--accent);
  border-radius: var(--r-card); padding: 14px 16px;
  box-shadow: 0 0 24px -10px var(--glow);
}
.next-mission-day { font-family: var(--mono); font-weight: 800; color: var(--accent); font-size: 13px; margin-bottom: 8px; letter-spacing: 1px; }
.next-mission-topics { margin: 0; padding-left: 18px; font-size: 13px; color: var(--text); line-height: 1.6; }
.next-mission-topics li { margin-bottom: 2px; }

/* ---------- view tabs ---------- */
.view-tabs { position: relative; z-index: 2; display: flex; gap: 6px; padding: 22px 28px 0; }
.view-tab {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--text-faint); background: transparent; border: 1px solid transparent;
  padding: 8px 14px; border-radius: var(--r-ctl) var(--r-ctl) 0 0; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.view-tab:hover { color: var(--text-dim); }
.view-tab-active { color: var(--text); border-bottom: 2px solid var(--accent-main); background: var(--bg-panel); }

/* ---------- period nav ---------- */
.period-nav { position: relative; z-index: 2; padding: 14px 28px 0; background: var(--bg-panel); }
.scope-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.scope-btn {
  font-family: var(--mono); font-size: 11px; font-weight: 600; cursor: pointer;
  color: var(--text-faint); background: var(--bg); border: 1px solid var(--border);
  padding: 6px 13px; border-radius: var(--r-pill); transition: all 0.15s ease;
}
.scope-btn:hover { color: var(--text-dim); border-color: var(--border-hover); }
.scope-btn-active { color: var(--on-accent); background: var(--accent); border-color: var(--accent); }
.period-summary { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
.period-summary-sep { color: var(--text-faint); }
.period-strip { display: flex; gap: 8px; overflow-x: auto; padding: 12px 0 14px; scrollbar-width: thin; }
.period-chip {
  flex: 0 0 auto; width: 132px; text-align: left; cursor: pointer;
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-card);
  padding: 9px 11px; transition: all 0.18s ease;
}
.period-chip:hover { border-color: var(--border-hover); transform: translateY(-1px); }
.period-chip-active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--bg)); }
.period-chip-complete .period-chip-label { color: var(--accent); }
.period-chip-top { display: flex; align-items: center; gap: 6px; }
.period-chip-label { font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--text); }
.period-here { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: var(--dot-glow); }
.period-chip-sub { font-size: 10.5px; color: var(--text-faint); margin: 2px 0 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.period-chip-track { height: 4px; background: var(--track); border-radius: var(--r-bar); overflow: hidden; }
.period-chip-fill { height: 100%; background: var(--accent); border-radius: var(--r-bar); transition: width 0.4s ease; }
.period-chip-meta { display: flex; justify-content: space-between; margin-top: 5px; font-family: var(--mono); font-size: 9.5px; color: var(--text-faint); }

/* ---------- controls row ---------- */
.controls-row {
  position: relative; z-index: 2;
  display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 4px 28px 14px; border-bottom: 1px solid var(--border); background: var(--bg-panel);
}
.search-wrap {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-ctl);
  padding: 8px 12px; flex: 0 1 320px; color: var(--text-faint);
}
.search-input { background: transparent; border: none; outline: none; color: var(--text); font-family: var(--mono); font-size: 12.5px; width: 100%; }
.search-input::placeholder { color: var(--text-faint); }
.domain-legend { display: flex; gap: 6px; flex-wrap: wrap; }
.domain-chip {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10.5px; color: var(--text-dim);
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-pill);
  padding: 5px 10px 5px 8px; cursor: pointer;
}
.domain-chip:hover { border-color: var(--border-hover); }
.domain-chip-active { color: var(--text); }
.domain-chip-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dot); }
.domain-chip-pct { color: var(--text-faint); }

/* ---------- console view ---------- */
.console-view { position: relative; z-index: 2; padding: 4px 28px 20px; display: flex; flex-direction: column; }
.day-row { border-bottom: 1px solid var(--border-soft); transition: background 0.2s ease; }
.day-row-current { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.day-row-header {
  width: 100%; display: flex; align-items: center; gap: 14px;
  background: transparent; border: none; cursor: pointer; text-align: left;
  padding: 11px 4px; color: var(--text);
}
.day-num {
  width: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-size: 11px; color: var(--text-faint);
}
.day-row-complete .day-num { color: var(--accent); }
.day-row-topics-preview { flex: 1; min-width: 0; display: flex; gap: 8px; overflow: hidden; }
.topic-chip-mini {
  display: flex; align-items: center; gap: 5px;
  font-size: 12.5px; color: var(--text-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  flex: 1 1 50%; min-width: 0;
}
.topic-chip-mini-done { color: var(--text-faint); text-decoration: line-through; text-decoration-color: var(--track); }
.domain-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.day-row-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.note-flag { color: var(--text-faint); display: flex; align-items: center; }
.day-row-complete .note-flag { color: var(--accent); }
.current-pill {
  font-family: var(--mono); font-size: 9px; font-weight: 700; letter-spacing: 1px;
  background: var(--accent); color: var(--on-accent); padding: 2px 7px; border-radius: var(--r-pill);
}
.day-row-frac { font-family: var(--mono); font-size: 11px; color: var(--text-faint); width: 28px; text-align: right; }
.chev { color: var(--text-faint); transition: transform 0.2s ease; }
.chev-open { transform: rotate(90deg); }
.day-row-body { padding: 4px 4px 16px 48px; display: flex; flex-direction: column; gap: 10px; }
.topic-line { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.topic-line input { display: none; }
.topic-checkbox {
  width: 19px; height: 19px; flex-shrink: 0; border-radius: var(--r-bar);
  border: 1.5px solid var(--text-faint); display: flex; align-items: center; justify-content: center;
  color: var(--on-accent); transition: all 0.15s ease;
}
.topic-line-done .topic-checkbox { background: var(--accent); border-color: var(--accent); }
.topic-text { flex: 1; font-size: 13.5px; color: var(--text); }
.topic-line-done .topic-text { color: var(--text-faint); text-decoration: line-through; }
.domain-tag { font-family: var(--mono); font-size: 9.5px; padding: 3px 8px; border-radius: var(--r-bar); border: 1px solid; white-space: nowrap; }

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; color: var(--text-faint); gap: 8px; }
.empty-state-title { font-family: var(--mono); font-size: 14px; color: var(--text-dim); }
.empty-state-sub { font-size: 12.5px; }

/* ---------- notes ---------- */
.note-block {
  margin-top: 6px; padding: 12px 14px;
  background: var(--bg-panel-2); border: 1px solid var(--border-soft); border-radius: var(--r-card);
}
.note-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.note-label {
  display: flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 1px; color: var(--text-faint); text-transform: uppercase;
}
.note-count { font-family: var(--mono); font-size: 10px; color: var(--text-faint); }
.note-input {
  width: 100%; min-height: 64px; resize: vertical;
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-ctl);
  color: var(--text); font-family: var(--sans); font-size: 13px; line-height: 1.65;
  padding: 10px 12px; outline: none; overflow: hidden;
}
.note-input:focus { border-color: var(--accent); }
.note-input::placeholder { color: var(--text-faint); }

/* ---------- grid view ---------- */
.grid-view { position: relative; z-index: 2; padding: 20px 28px 20px; }
.grid-view-caption { font-family: var(--mono); font-size: 11px; color: var(--text-faint); margin-bottom: 14px; }
.heatmap { display: grid; grid-template-columns: repeat(auto-fill, minmax(30px, 1fr)); gap: 5px; }
.heat-cell {
  position: relative; aspect-ratio: 1; border-radius: var(--r-ctl); border: 1px solid var(--border);
  background: var(--bg-panel); cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: transform 0.12s ease;
}
.heat-cell:hover { transform: scale(1.15); z-index: 3; }
.heat-cell-num { font-family: var(--mono); font-size: 8.5px; color: var(--text-faint); }
.heat-level-1 { background: color-mix(in srgb, var(--accent) 38%, var(--bg-panel)); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.heat-level-1 .heat-cell-num { color: var(--on-accent-soft); }
.heat-level-2 { background: var(--accent); border-color: var(--accent); }
.heat-level-2 .heat-cell-num { display: none; }
.heat-cell-check { position: absolute; color: var(--on-accent); }
.heat-cell-note { position: absolute; top: 2px; right: 2px; width: 4px; height: 4px; border-radius: 50%; background: var(--text-dim); }
.heat-level-2 .heat-cell-note { background: var(--on-accent-soft); }
.heat-legend { display: flex; align-items: center; gap: 6px; margin-top: 16px; font-family: var(--mono); font-size: 10.5px; color: var(--text-faint); }
.heat-legend-swatch { width: 14px; height: 14px; cursor: default; }
.heat-legend-swatch:hover { transform: none; }

/* ---------- log view ---------- */
.log-view { position: relative; z-index: 2; padding: 20px 28px 20px; }
.log-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
@media (max-width: 800px) { .log-grid { grid-template-columns: 1fr; } }
.log-panel { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--r-card); padding: 18px 20px; }
.log-panel-title { font-family: var(--mono); font-size: 11px; letter-spacing: 1.5px; color: var(--text-faint); margin-bottom: 14px; }
.log-panel-body { display: flex; flex-direction: column; gap: 10px; max-height: 340px; overflow-y: auto; }
.log-bar-row { display: flex; align-items: center; gap: 10px; }
.log-bar-label { font-size: 12px; width: 110px; flex-shrink: 0; }
.log-bar-label-mono { font-family: var(--mono); color: var(--text-dim); }
.log-bar-track { flex: 1; height: 7px; background: var(--track); border-radius: var(--r-bar); overflow: hidden; }
.log-bar-fill { height: 100%; border-radius: var(--r-bar); transition: width 0.5s ease; }
.log-bar-val { font-family: var(--mono); font-size: 11px; color: var(--text-faint); width: 46px; text-align: right; flex-shrink: 0; }
.log-summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 700px) { .log-summary-strip { grid-template-columns: 1fr 1fr; } }
.summary-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--r-card); padding: 16px; text-align: center; }
.summary-card-value { font-family: var(--mono); font-size: 26px; font-weight: 800; color: var(--accent); }
.summary-card-label { font-size: 11.5px; color: var(--text-dim); margin-top: 4px; }
.summary-card-sub { font-size: 10.5px; color: var(--text-faint); }

/* ---------- toast ---------- */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-panel); border: 1px solid var(--accent-main); color: var(--text);
  font-family: var(--mono); font-size: 12.5px; font-weight: 600;
  padding: 10px 18px; border-radius: var(--r-ctl); z-index: 50;
  animation: toastIn 0.25s ease;
}
.toast-day { border-color: var(--accent-sprint); color: var(--accent-sprint); }
@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ---------- confetti ---------- */
.confetti-layer { position: fixed; inset: 0; pointer-events: none; z-index: 60; overflow: hidden; }
.confetti-piece { position: absolute; top: -10px; width: 7px; height: 12px; opacity: 0.9; animation: confettiFall 1.3s ease-in forwards; }
@keyframes confettiFall { to { transform: translateY(100vh) translateX(var(--drift)) rotate(400deg); opacity: 0; } }

/* ---------- footer ---------- */
.app-footer {
  position: relative; z-index: 2;
  text-align: center; padding: 24px; font-family: var(--mono); font-size: 10.5px; color: var(--text-faint);
  border-top: 1px solid var(--border); margin-top: 20px;
}

/* ---------- tab badge ---------- */
.tab-badge {
  font-family: var(--mono); font-size: 9px; font-weight: 700;
  background: var(--accent-main); color: var(--on-accent);
  padding: 1px 6px; border-radius: var(--r-pill); margin-left: 2px;
}

/* ---------- related days ---------- */
.related-block { margin-top: 4px; }
.related-label {
  font-family: var(--mono); font-size: 10px; letter-spacing: 1px; text-transform: uppercase;
  color: var(--text-faint); margin-bottom: 7px;
}
.related-row { display: flex; gap: 8px; flex-wrap: wrap; }
.related-chip {
  display: flex; flex-direction: column; gap: 2px; text-align: left; cursor: pointer;
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-ctl);
  padding: 7px 10px; max-width: 260px;
}
.related-chip:hover { border-color: var(--accent); }
.related-day { font-family: var(--mono); font-size: 10.5px; font-weight: 700; color: var(--accent); }
.related-topics {
  font-size: 11.5px; color: var(--text-dim);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;
}
.related-terms {
  font-family: var(--mono); font-size: 9.5px; color: var(--text-faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px;
}

/* ---------- day tools ---------- */
.day-tools { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.tool-btn {
  display: flex; align-items: center; gap: 6px; cursor: pointer;
  font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--text-dim);
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-ctl); padding: 6px 12px;
}
.tool-btn:hover { color: var(--text); border-color: var(--accent); }
.note-match {
  font-family: var(--mono); font-size: 8.5px; font-weight: 700; letter-spacing: 0.5px;
  color: var(--on-accent); background: var(--accent-sprint); padding: 2px 6px; border-radius: var(--r-pill);
}
.data-btn { cursor: pointer; }
.data-btn:hover { border-color: var(--border-hover); }

/* ---------- review view ---------- */
.review-view { position: relative; z-index: 2; padding: 24px 28px 20px; max-width: 720px; }
.review-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.review-count {
  font-family: var(--mono); font-size: 12px; font-weight: 700; color: var(--on-accent);
  background: var(--accent); padding: 3px 10px; border-radius: var(--r-pill);
}
.review-meta { font-family: var(--mono); font-size: 11px; color: var(--text-faint); }
.review-card {
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--r-card);
  padding: 22px 24px; margin-bottom: 14px;
}
.review-prompt { font-size: 13px; color: var(--text-dim); margin-bottom: 14px; }
.review-topics { margin: 0 0 18px; padding-left: 20px; font-size: 16px; line-height: 1.7; color: var(--text); }
.reveal-btn {
  cursor: pointer; font-family: var(--mono); font-size: 12px; font-weight: 600;
  color: var(--text-dim); background: var(--bg); border: 1px dashed var(--border-hover);
  border-radius: var(--r-ctl); padding: 10px 16px; width: 100%;
}
.reveal-btn:hover { color: var(--text); border-color: var(--accent); }
.review-note { border-top: 1px solid var(--border-soft); padding-top: 14px; }
.review-note-text {
  margin: 0 0 12px; font-family: var(--sans); font-size: 13.5px; line-height: 1.7; color: var(--text);
  white-space: pre-wrap; word-break: break-word;
}
.review-note-empty { font-size: 13px; color: var(--text-faint); margin-bottom: 12px; }
.review-open-link {
  cursor: pointer; background: none; border: none; padding: 0;
  font-family: var(--mono); font-size: 11.5px; color: var(--accent);
}
.grade-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.grade-btn {
  display: flex; flex-direction: column; gap: 3px; align-items: center; cursor: pointer;
  font-family: var(--mono); font-size: 13px; font-weight: 700;
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--r-card);
  padding: 13px 10px; color: var(--text);
}
.grade-sub { font-size: 9.5px; font-weight: 500; color: var(--text-faint); letter-spacing: 0.3px; }
.grade-forgot:hover { border-color: var(--err); color: var(--err); }
.grade-shaky:hover { border-color: var(--warn); color: var(--warn); }
.grade-solid:hover { border-color: var(--ok); color: var(--ok); }
.skip-btn {
  margin-top: 12px; cursor: pointer; background: none; border: none;
  font-family: var(--mono); font-size: 11px; color: var(--text-faint);
}
.skip-btn:hover { color: var(--text-dim); }
.review-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 70px 20px; color: var(--text-faint); text-align: center; }
.review-empty-title { font-family: var(--mono); font-size: 15px; color: var(--text); }
.review-empty-sub { font-size: 13px; max-width: 380px; }

/* ---------- weekly view ---------- */
.weekly-view { position: relative; z-index: 2; padding: 22px 28px 20px; }
.weekly-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
@media (max-width: 760px) { .weekly-strip { grid-template-columns: 1fr 1fr; } }
.weekly-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
@media (max-width: 800px) { .weekly-grid { grid-template-columns: 1fr; } }
.week-bars { display: flex; align-items: flex-end; gap: 8px; height: 150px; }
.week-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; height: 100%; }
.week-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.week-bar { width: 100%; border-radius: var(--r-bar) var(--r-bar) 0 0; min-height: 3px; transition: height 0.4s ease; }
.week-bar-num { font-family: var(--mono); font-size: 11px; color: var(--text-dim); }
.week-bar-label { font-family: var(--mono); font-size: 10px; color: var(--text-faint); }
.weekly-empty { font-size: 12.5px; color: var(--text-faint); line-height: 1.6; }
.question-row {
  display: flex; gap: 10px; align-items: baseline; text-align: left; cursor: pointer; width: 100%;
  background: transparent; border: none; border-bottom: 1px solid var(--border-soft);
  padding: 8px 2px; color: var(--text-dim);
}
.question-row:hover { color: var(--text); }
.question-day { font-family: var(--mono); font-size: 10.5px; color: var(--accent); flex-shrink: 0; }
.question-text { font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.weekly-footer { display: flex; justify-content: flex-end; }

/* ---------- modal ---------- */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 70;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(3px);
  display: flex; align-items: flex-start; justify-content: center; padding: 6vh 16px 16px;
  overflow-y: auto;
}
.modal {
  width: 100%; max-width: 620px;
  background: var(--bg-panel); border: 1px solid var(--border-hover); border-radius: var(--r-card);
}
.modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.modal-title { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--text); }
.modal-close { cursor: pointer; background: none; border: none; color: var(--text-faint); display: flex; padding: 4px; }
.modal-close:hover { color: var(--text); }
.modal-body { padding: 18px; }
.panel-intro { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.panel-copy { font-size: 13px; color: var(--text-dim); line-height: 1.65; margin: 0; }
.panel-loading { font-family: var(--mono); font-size: 12.5px; color: var(--text-dim); padding: 26px 0; text-align: center; }
.panel-error { font-size: 12.5px; color: var(--err); }
.panel-actions { display: flex; gap: 9px; flex-wrap: wrap; }
.primary-btn {
  cursor: pointer; font-family: var(--mono); font-size: 12px; font-weight: 700;
  background: var(--accent); color: var(--on-accent); border: 1px solid var(--accent);
  border-radius: var(--r-ctl); padding: 9px 16px;
}
.secondary-btn {
  cursor: pointer; font-family: var(--mono); font-size: 12px; font-weight: 600;
  background: transparent; color: var(--text-dim); border: 1px solid var(--border);
  border-radius: var(--r-ctl); padding: 9px 16px;
}
.secondary-btn:hover { color: var(--text); border-color: var(--border-hover); }

.quiz-list { display: flex; flex-direction: column; gap: 14px; }
.quiz-item { border-bottom: 1px solid var(--border-soft); padding-bottom: 13px; }
.quiz-q { display: flex; gap: 9px; font-size: 14px; line-height: 1.6; color: var(--text); margin-bottom: 9px; }
.quiz-num { font-family: var(--mono); font-size: 11px; color: var(--accent); flex-shrink: 0; padding-top: 3px; }
.quiz-a { font-size: 13px; line-height: 1.7; color: var(--text-dim); padding-left: 21px; }
.quiz-reveal {
  cursor: pointer; margin-left: 21px; font-family: var(--mono); font-size: 11px;
  background: transparent; border: 1px dashed var(--border-hover); color: var(--text-faint);
  border-radius: var(--r-ctl); padding: 5px 11px;
}
.quiz-reveal:hover { color: var(--text-dim); border-color: var(--accent); }

.draft-wrap { display: flex; flex-direction: column; gap: 12px; }
.draft-text {
  width: 100%; resize: vertical; background: var(--bg); border: 1px solid var(--border);
  border-radius: var(--r-ctl); color: var(--text); font-family: var(--sans);
  font-size: 13.5px; line-height: 1.7; padding: 13px 15px; outline: none;
}
.draft-text:focus { border-color: var(--accent); }

.data-panel { display: flex; flex-direction: column; gap: 20px; }
.data-stat { font-family: var(--mono); font-size: 11.5px; color: var(--text-faint); }
.data-section { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.data-section-title {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-faint);
}

/* ---------- notes generator ---------- */
.notesgen { display: flex; flex-direction: column; gap: 16px; }
.gen-field { display: flex; flex-direction: column; gap: 7px; }
.gen-label {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 1.2px;
  text-transform: uppercase; color: var(--text-faint);
}
.seg-row { display: flex; gap: 6px; flex-wrap: wrap; }
.seg-btn {
  cursor: pointer; font-family: var(--sans); font-size: 12px;
  background: var(--bg); border: 1px solid var(--border); color: var(--text-dim);
  border-radius: var(--r-ctl); padding: 8px 12px; text-align: left;
  max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.seg-btn:hover { border-color: var(--border-hover); color: var(--text); }
.seg-btn-active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--bg)); color: var(--text); }
.gen-hint { font-size: 11.5px; color: var(--text-faint); }
.gen-output {
  max-height: 46vh; overflow-y: auto;
  background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-ctl);
  padding: 14px 16px;
}
.gen-footnote { font-size: 11.5px; color: var(--text-faint); line-height: 1.6; margin: 0; }

/* ---------- markdown rendering ---------- */
.md { font-size: 13.5px; line-height: 1.7; color: var(--text); }
.md-h { font-family: var(--display); font-weight: 700; color: var(--text); margin: 16px 0 7px; }
.md-h:first-child { margin-top: 0; }
.md-h1 { font-size: 16px; }
.md-h2 { font-size: 15px; }
.md-h3 { font-size: 13.5px; color: var(--accent); }
.md-h4 { font-size: 12.5px; color: var(--text-dim); }
.md-p { margin: 0 0 9px; }
.md-ul { margin: 0 0 10px; padding-left: 20px; }
.md-ul li { margin-bottom: 4px; }
.md code {
  font-family: var(--mono); font-size: 12px;
  background: var(--bg-panel-2); border: 1px solid var(--border-soft);
  padding: 1px 5px; border-radius: var(--r-bar);
}
.md-pre {
  position: relative; margin: 10px 0 12px; padding: 13px 14px;
  background: var(--bg-panel-2); border: 1px solid var(--border);
  border-radius: var(--r-ctl); overflow-x: auto;
}
.md-pre code {
  font-family: var(--mono); font-size: 12px; line-height: 1.65;
  background: none; border: none; padding: 0; white-space: pre; color: var(--text);
}
.md-lang {
  position: absolute; top: 6px; right: 10px;
  font-family: var(--mono); font-size: 9px; letter-spacing: 0.6px;
  text-transform: uppercase; color: var(--text-faint);
}

/* ---------- reference block ---------- */
.ref-block { margin-top: 4px; border: 1px solid var(--border-soft); border-radius: var(--r-card); overflow: hidden; }
.ref-head {
  width: 100%; display: flex; align-items: center; gap: 8px; cursor: pointer;
  background: var(--bg-panel-2); border: none; padding: 9px 12px; color: var(--text-dim);
  text-align: left;
}
.ref-head:hover { color: var(--text); }
.ref-title { font-family: var(--mono); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; }
.ref-topic {
  flex: 1; font-size: 11.5px; color: var(--text-faint);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ref-body { padding: 14px 16px; background: var(--bg); }
.ref-actions { display: flex; gap: 8px; margin-top: 14px; }

/* ---------- no-effects theme overrides ---------- */
.no-fx .switcher-tab-active { box-shadow: 0 0 0 1px var(--accent) inset; }
.no-fx .next-mission-card { box-shadow: none; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-hover); border-radius: var(--r-bar); }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;
