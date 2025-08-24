Node-Based Backtest Web Application – Product Requirements Document
Overview & Goals

We are extending our existing node-based backtesting prototype into a full browser-based application. The goal is to empower quantitative strategy developers to compose, test, and iterate on trading strategies entirely via a web UI, while ensuring safety and scalability. Key features will include a modern Svelte + TailwindCSS (DaisyUI) front-end, in-browser code editing with Monaco, support for custom pipeline nodes in multiple languages (Python, JavaScript, WebAssembly), a DSL-based pipeline definition (textual strategy scripts instead of drag-and-drop), and secure sandboxed execution (Docker-based) for running user code and model training. We will integrate with machine learning frameworks (e.g. PyTorch, TensorFlow) to support model training as part of backtest pipelines. This document details the requirements for functionality, roles, UI/UX, backend services, storage, security, technical stack, and an iterative roadmap to deliver the product safely with a small development team.

1. Functional Requirements

The application must fulfill several core functions for end-users (strategy developers) and admins:

Pipeline Authoring (DSL Editing): Users can create and edit trading strategy pipelines using a custom DSL (domain-specific language) instead of a visual editor. The DSL will allow declaratively defining the sequence of nodes (data sources, indicators, execution logic, etc.) and their connections. This text-based strategy/steps language will compose pipelines in a clear, readable format (e.g. possibly a Given/When/Then structure or JSON/YAML script)
GitHub
. The system should validate DSL scripts for correctness (e.g. proper syntax, references to valid node types, matching input/output data types) before execution. Autocompletion and syntax highlighting in the editor will assist users in writing valid pipelines.

Custom Node Development (Multi-Language): Users can create custom nodes – reusable components of logic – and implement their behavior in Python, JavaScript, or WebAssembly. The UI will allow writing and editing the code for these nodes in-browser via the Monaco editor. Each node will have a defined interface (inputs, outputs, parameters), and users can provide code that adheres to this interface. The system must be able to compile/build these nodes if necessary (e.g. compile WebAssembly modules or transpile code) and register them so they can be used in pipelines. For WebAssembly, users might upload precompiled .wasm modules or write in a language that can be compiled to WASM. The application should treat these custom nodes as first-class pipeline components once defined.

Pipeline Execution (Backtesting Runs): Users can execute the pipeline defined by the DSL to run backtests. Execution entails orchestrating the data flow through the nodes in the pipeline (forming a directed acyclic graph of tasks). The system will take historical data (from user-provided datasets or integrated data sources) and feed it through the strategy logic nodes, ultimately producing results such as trading signals, executed trades, P&L, and performance metrics. It should be possible to run pipelines on-demand (triggered by the user in the UI) and eventually schedule or repeat runs if needed. The execution engine must handle sequencing of node execution according to dependencies and combine outputs appropriately.

Model Training Integration: The pipeline should support nodes that perform model training using external ML libraries (e.g. PyTorch, TensorFlow). For example, a user might include a “Model Training” node in the pipeline that, when executed, trains a machine learning model on historical data (for example, training a predictive model or optimizing a strategy parameter). The system should provide an environment with the necessary libraries (inside the Docker sandbox) for these training tasks, and allow the node’s code (Python, likely) to utilize GPU or other resources if available. After training, the model artifact (e.g. a .pth or .h5 file) can be saved as part of the run’s results. The pipeline should be able to use the trained model in subsequent steps (e.g. a prediction node) or at least output it as an artifact for the user to download or analyze.

Result Reporting & Visualization: After a pipeline/backtest run, the system should output reports/metrics (e.g. total return, drawdown, Sharpe ratio) and possibly time-series outputs (like an equity curve or trade log). The UI must allow users (and observers) to view these results in a clear format. This may include summary statistics displays, charts for equity curve, and tables of trades. While a full visual analytics dashboard is not required at MVP, the design should accommodate adding such visualization components. (We can leverage DaisyUI components or a Canvas App plugin approach in future to drop in visualization widgets for results.)

Pipeline & Node Management: Users should be able to save and manage multiple pipeline definitions (each identified by name, with versioning if possible). They should also manage custom nodes – e.g. list created nodes, edit their code, and possibly share them or publish to a library. The system should maintain associations of pipeline definitions with specific versions of custom nodes to ensure reproducibility. An admin interface or commands might allow cleaning up or updating these definitions.

Compilation & Validation: There will be a pipeline compiler service that translates the DSL script into an executable pipeline graph. This includes validating that all referenced node types exist (either built-in or user-defined), that node parameters are provided and valid, and that data contracts match (for instance, the output of one node matches the expected input schema of the next). Type-checking using predefined schemas (like JSON schemas for time-series, signals, etc.) can be applied to catch errors early
GitHub
GitHub
. The compiler will either produce an intermediate representation (IR) or directly instantiate the pipeline in the execution engine. Any errors in the DSL (syntax or semantic) should be fed back to the user (preferably highlighted in the editor).

Execution Monitoring & Logs: When a pipeline runs, users (and admins) should be able to monitor its progress. This could be a simple status (Running/Completed/Failed) indicator for MVP, and logs or console output from nodes if available. If a run fails (e.g. due to code error in a custom node), the user should receive error information (stack trace or validation error) to debug. All runs should be logged, and key events (node start/finish, errors) recorded. In future, a real-time log console or step-by-step execution trace can be shown in the UI for debugging complex pipelines.

2. User Roles and Permissions

We will support multiple user roles to manage access and ensure safe operation:

Strategy Developer (Author): The primary user persona. Developers can create and edit pipelines using the DSL, write custom node code, and execute backtests. They have access to the Monaco code editor and can upload or import data for their strategies. They can also view all results of their own runs. Strategy Devs cannot change system-level settings but can configure their own pipelines and nodes. They should be authenticated users in the system.

Administrator: Admins have full access to the system. In addition to all Strategy Developer capabilities, an Admin can manage user accounts, adjust resource limits, and oversee all running pipelines. Admins can view and terminate any pipeline run if it’s consuming too many resources or stuck. They can also manage the library of built-in nodes or approve custom nodes if we require moderation. Security and sandbox configurations (like Docker container base images, allowed libraries, global resource quotas) are managed by Admins. Admins may also handle connecting the system to external data sources or ML infrastructure.

Observer (Read-Only User): This role can view existing pipelines and their results but cannot edit or execute them. Observers might be research leads or stakeholders who want to review strategy performance. They can navigate through the UI to see pipeline definitions (perhaps in a read-only DSL editor view) and look at reports/visualizations of past runs. They cannot create new pipelines, modify code, or start runs. This role ensures that sensitive pipelines can be shared for viewing without risk of alteration or execution.

(In the initial MVP, we may implement a simpler permission model (e.g. all authenticated users as developers) and later introduce fine-grained roles. The design, however, will account for these roles so that adding permissions checks is straightforward.)

3. User Interface Components

The web application’s UI will be built with Svelte for reactivity and TailwindCSS + DaisyUI for styling and pre-built components, ensuring a clean and responsive design. Key interface components include:

Pipeline DSL Editor: A central text editing panel where the user writes or modifies the pipeline DSL script. This will likely use the Monaco Editor (the VS Code editor component) configured for our DSL syntax. It should provide syntax highlighting, basic IntelliSense/autocomplete for known node types or DSL keywords, and error marking for invalid syntax. The editor might come with templates or snippets to help users get started (e.g. a snippet for a simple pipeline structure). Because we are not using a visual canvas, this editor is the primary way to construct pipelines, so it must be user-friendly and well-integrated. For example, clicking on a node in a pipeline outline (if we have a sidebar listing pipeline nodes) could jump to that part of the script in the editor.

Monaco Code Editor for Nodes: When a user wants to create or edit a custom node’s code, they will use a Monaco Editor instance configured for that language (Python or JavaScript). This could be presented in a tabbed interface or a modal. The editor should have language-specific features like syntax highlighting, perhaps linting or auto-completion (e.g. via Monaco’s Python and JavaScript language support). Multiple tabs might be available if a node consists of multiple files, but for MVP we can assume a single file per node (with maybe an optional separate test or config file). The code editor will be embedded directly in the app, allowing for quick iteration. We will aim to include templates for common node patterns (e.g. a template code for a new indicator node) to expedite development
GitHub
.

Node Configuration Viewer/Editor: A sidebar or modal that displays the configuration of a selected node in the pipeline. For built-in nodes or custom nodes that have defined parameters, this component shows a form or list of parameters (with fields like numbers, text, select options, etc., potentially using DaisyUI form elements). Users can adjust parameter values here, which will update the DSL script accordingly (or vice-versa – editing the script changes the displayed config). This provides a more guided way to configure nodes without manually editing every detail in code. For read-only users, this viewer would simply display the parameters. For developers, it’s editable. This component ensures that even though the pipeline is defined in text, users have an assistive UI for parameters and do not have to recall every field name by heart.

Run Controls and Status: The UI will include controls to run a pipeline and display its status/progress. For example, a “Run Backtest” button (possibly on a toolbar or near the editor) allows the user to execute the current pipeline. Once running, a status indicator (e.g. a spinner or progress bar) and a log output area should appear. The log output could be a collapsible panel showing real-time messages from the execution engine (node start/finish, print statements or errors). At MVP, this could be rudimentary (just final success/failure notification), but design for expansion to show detailed logs. Also, provide a way to cancel a running pipeline (for developers or admins) via the UI.

Results Display: After a run completes, the UI should present the results. This could include:

Metrics Summary: Key performance metrics (profit, return %, volatility, Sharpe ratio, max drawdown, etc.) in a card or table format.

Charts: An equity curve line chart (capital over time) and possibly other charts like drawdown over time or indicator vs price if relevant. (We can integrate a lightweight charting library or build a simple SVG chart component).

Trade Logs: A table of executed trades (timestamp, action buy/sell, quantity, price, resulting P&L).

If the pipeline produced any artifacts (like a trained model or a data file), provide download links or references.
These components can initially be simple (even just data tables or text), but the PRD anticipates richer visualization in later phases. DaisyUI’s pre-built components for collapsible panels, tables, and alerts can be used to format these results cleanly.

Navigation & Layout: The application will have a navigation structure to manage multiple pipelines and nodes. For example, a sidebar listing saved pipelines (for the current user or project), and another section for custom nodes library. Users can switch between pipelines or create new ones. The overall layout might be split into a main editor area (taking majority of screen), and side panels for pipeline list, node list, or config. DaisyUI’s responsive components (drawer for side menu, tabs, etc.) will help manage this. Ensure that the UI remains usable on different screen sizes (likely desktop-focused due to coding nature, but should handle at least various desktop resolutions).

Login/Account Management (if applicable): If multi-user support is in scope early, provide a simple login page and possibly a user profile dropdown. This could be handled by a minimal authentication UI (we can use DaisyUI form components for login forms). Admin users might get an additional admin panel link.

(No drag-and-drop canvas is required, so we will not implement the graphical node linking UI. However, we will ensure the DSL and supporting UI still give a clear picture of the pipeline structure. Optionally, we might include a read-only pipeline outline view that lists nodes and their order, derived from the DSL, to help users visualize the flow.)

4. Backend Services & Components

The system’s backend will be structured to separate concerns of pipeline definition, execution, and supporting services. Key backend components include:

Pipeline Compiler Service: A service (or module) that takes the DSL script as input and produces a validated pipeline plan (executable graph). It will parse the DSL, verify syntax and semantics, and ensure all node references are known. This compiler will use a catalog of node definitions (including built-in nodes and any custom nodes the user has defined) to resolve node IDs in the script. It will also enforce that data flowing between nodes adheres to expected schemas/contracts (e.g., a node output labeled as series.ohlcv can only connect to an input expecting that same format)
GitHub
GitHub
. The output of the compiler could be a JSON representation of the pipeline (listing each node instance with its configured params and linking of outputs to inputs) or an in-memory structure the execution engine can use. If there are errors (unknown node, type mismatch, missing required param), the compiler returns errors that get relayed to the user interface. This service could be implemented in Node.js (or Python) and can be part of the main backend process for MVP.

Execution Engine: The execution engine is responsible for running the pipeline graph produced by the compiler. It orchestrates the execution of each node in the correct order, handling data passing between nodes. For built-in nodes that are internally implemented (e.g., a built-in indicator or data loader), the engine will call the corresponding function/module directly. For custom code nodes, the engine will spawn an isolated sandboxed environment (see Security section) to run the user’s code. The engine manages the lifecycle of these sandboxed runs: sending input data and parameters to the node code, executing it, and capturing its outputs (or errors). It also applies any output validation (if schemas are defined, ensure the node returns data in the expected format). The execution engine might be implemented as a service that receives a pipeline execution request (with the pipeline definition or an ID) and runs it asynchronously, reporting back status and results. It could be a standalone Node.js process or a module in the web server that spawns worker processes/containers for each run. Ensuring non-blocking operation is important so multiple pipelines can run in parallel (subject to resource limits). The engine will log execution events for auditing and debugging (start/end times, resource usage, errors).

Sandboxed Code Runners: A crucial backend component is the sandbox management. To run custom node code securely, the system will rely on Docker containers (or similar isolation) launched on-demand. We may have language-specific sandbox services:

A Python Runner service or container image for Python nodes (pre-installed with common libraries like numpy, pandas, PyTorch, TensorFlow, etc.).

A JavaScript/Node.js Runner for JS nodes (could reuse the main Node environment but better to isolate in a subprocess or separate V8 context; alternatively use a Docker container with Node runtime).

Possibly a WASM Runner which could be a service that loads WebAssembly modules in a restricted environment (using a runtime like Wasmtime or even within Node via WebAssembly API, keeping it memory and time limited).

The backend will decide, based on the node’s specified language/runtime, which sandbox to invoke. It will package the node’s code and inputs, then call the sandbox runner (e.g., via an API or by CLI command to run a Docker container) to execute it. For MVP, a simpler approach might be to use a Node.js sandbox for both JavaScript and WebAssembly (since Node can execute JS directly and load WASM modules)
GitHub
, and use Docker only for Python nodes (which cannot run in Node’s V8). Each execution will have a timeout and memory limit, and the sandbox runner will enforce those (for instance, Docker resource limits or internal checks). After execution, results are returned to the engine.

Model Training Service: While model training jobs could be handled by the same execution engine/sandbox mechanism, we might separate them if they are long-running or resource-intensive. A Model Training service could accept training tasks (with code or predefined training routines, plus data) and run them possibly on specialized infrastructure (like a machine with GPU or a remote job queue). For now, we plan to integrate training by using the Python sandbox with ML libraries. If a training node is executed, the execution engine can invoke the Python runner with the training code. To support this, we must ensure the Python environment has the required libraries and possibly GPU access (if within our infrastructure and using nvidia-docker or similar). The training service (or the general execution service) should store the resulting model artifact in the storage system. In the future, if we allow very large or asynchronous training jobs, we might integrate a job queue (like Celery or AWS Sagemaker for managed training), but for the prototype stage, this is out of scope.

Web API Backend: The application will expose a set of HTTP API endpoints (REST or GraphQL) that the front-end uses to perform actions: e.g. CRUD operations for pipelines and nodes, triggering a pipeline run, fetching run results, authenticating users, etc. This API layer is essentially our web server (which could be built with Node.js using a framework or SvelteKit). It will coordinate calls to the compiler and execution engine and stream results back to the client. For example, when a user clicks “Run”, the front-end calls POST /api/runPipeline with the pipeline ID or DSL; the backend then calls the compiler, then the execution engine, and returns a run ID. The client might then poll or subscribe to GET /api/runStatus/{id} for updates until completion, then fetch results via GET /api/runResult/{id}.

Data Management Services: We may need supporting services for data. For instance, if historical market data or datasets are uploaded by users, a Data Service could handle storing and providing these to pipelines. If connecting to external data APIs (e.g. pulling data from an exchange or database), that would be handled by specific nodes or connectors configured by the user, and those might rely on separate modules or microservices to fetch data. At minimum, for MVP, we might allow users to upload a CSV of historical prices which is stored in our storage system and accessed by a “CSV Data” node during execution.

Authentication & User Management: If multi-user, the backend will include an auth service (could be part of the main app) to handle login, JWT token issuance, and role checking. A user database stores credentials (or uses an OAuth provider if chosen later). Admin-specific APIs (like stopping a running container, or reviewing all pipelines) will be protected to admin role.

Logging and Monitoring: A backend component (or simply a practice) will collect logs from the execution engine and sandbox runs. This includes capturing stdout/stderr from Docker containers or worker processes. We might use a lightweight logging framework or even just aggregate logs to files/DB. For monitoring resource usage (important for sandbox security), the system should track CPU, memory usage of each run (Docker stats or OS metrics). If possible, implement alerts or automatic termination for runaway processes (e.g. if a process exceeds memory or time, ensure it’s killed). These measures keep the system stable.

In summary, the backend architecture will consist of a web server (serving the UI and APIs), a Pipeline Compiler component, an Execution Engine that interfaces with Docker sandbox runners, and storage and auth subsystems as needed. The design is modular so that each piece can be scaled or replaced (for example, swapping out the execution engine or adding a job queue in future) without affecting the others.

5. Storage Plan

We need to store various entities: pipeline definitions, node code, datasets, models, and results. Our storage approach will likely combine a database for metadata and an object store or filesystem for large binaries:

Pipeline Definitions (DSL Scripts): Each pipeline (strategy) is stored persistently so users can revisit and rerun them. We will use a relational database (e.g. PostgreSQL) to store pipeline records. Each record includes metadata (pipeline name, owner, last modified, etc.) and the DSL script (as text or JSON, possibly compressed). We might also store a compiled form of the pipeline (serialized graph) for quick execution, but the source DSL is the primary truth. Versioning should be considered – initially, we might do simple version history (save copies or use a version column) so users can rollback changes. Pipelines are linked to the user (owner) and possibly to an Experiment or Project if we group them. The database ensures concurrency control (two users editing the same pipeline) and security (only authorized can access).

Custom Node Code: The code for user-created nodes needs to be saved as well. We can treat each custom node similar to a piece of source code in a mini repository. Likely, we store node code in the database too, in a separate table (e.g. nodes table with fields: node id, name, language, code text, owner, maybe version). Alternatively, for ease of file system operations, we might store them as files on disk (or in a Git repository) – but database storage gives us transactional updates and association with users. Each node should have a unique identifier and possibly version information if users update a node’s code over time. For safety, if a pipeline was run with an older version of a node, we may want to preserve that version (so, consider either immutability of node versions or storing node code snapshots with pipeline runs). For MVP, a simpler approach is to update node code in place (no versioning), but design the schema to allow adding a version or making a new node entry for changes. Node code tends to be small (just text), so storing in DB is fine. We will also store metadata like the language, and any manifest info (like what inputs/outputs it declares, so compiler can validate usage).

Datasets (Historical Data): For running backtests, users might need to supply data (if not using an external source node). We should support uploading datasets such as CSV files of historical OHLCV prices, or other asset data. These files can be stored in an object storage (e.g. AWS S3 or a blob storage service) or on the server’s filesystem (in a designated directory). Using object storage is scalable and safer, but for a small prototype, we might start with filesystem storage with a clear limit on file size and number. Each dataset would be associated with a user or an experiment. The storage plan should include a directory structure or naming convention to avoid collisions (e.g. include user ID and dataset name in the path). We must also store metadata about each dataset (name, description, date uploaded, etc.) in the database, referencing the file path or URL. Optionally, integrate a data library for efficient access (like storing time-series in a database or using Apache Arrow/Parquet for performance) – but MVP can stick to simple file usage. We should impose size limits to avoid exhausting storage (e.g. max 100MB per dataset for now, configurable by admin).

Model Artifacts: When a model training node runs and produces a model (e.g. a neural network weights file), that artifact should be saved so it can be reused or downloaded. These could be binary files (like .pt or .pickle files). We will store model files similarly to datasets – either on disk or object storage – and record their location in a models table or as part of the run results. It’s important to tag them with the pipeline run and the node that produced it, for traceability. Since models can be large, we should plan for storage accordingly (and potentially cleanup strategies if space becomes an issue, maybe letting users manage their saved models).

Pipeline Run Results and Artifacts: Each time a pipeline is executed, we may want to save key outputs for later review (especially if an observer will look at results or for comparing runs). This includes the performance metrics, summary stats, and possibly the full trade log or equity curve data. Storing everything in the DB might be too heavy if the run outputs large time-series, so an approach is:

Store small summary stats directly in a runs table (columns like return, sharpe, num_trades, etc. plus a reference to the pipeline and timestamp of run).

If there are large artifacts (e.g. a full equity curve time series, or trade-by-trade list, or any charts), serialize those to a file (JSON, CSV, or binary) and store in an artifact storage (like how an artifact broker would handle it). The runs table would then reference those artifact files by an ID or path.

For any model files produced, link them to the run as well (so one can find which run produced which model).

This approach keeps the database lean while allowing retrieval of detailed results when needed. Users should be able to access past run results via the UI (perhaps by selecting a past run from a history list in the pipeline view), which will fetch from the stored artifacts.

Configuration & Secrets: There may be config data like Docker image names, resource limits, or integration API keys (if external data APIs are used). These will be stored securely. E.g., if an exchange API key is needed for a node, the user might store it in a secure vault or we might allow saving encrypted secrets tied to the user. However, dealing with secrets might be beyond MVP scope, so for now we assume no external API calls that need auth (or if needed, user enters credentials each time or config in node param which is not ideal for security). For Docker and system config, a config file or environment variables on the server will hold those settings.

In summary, the storage solution will likely leverage a PostgreSQL database for structured data (pipelines, nodes, runs metadata, users) and file storage (local or cloud) for large blobs (data files, model binaries, detailed outputs). We will enforce quotas per user (for number of pipelines, size of data stored, etc.) to prevent abuse – e.g. an admin-configurable limit on total storage per user or overall.

6. Security & Sandboxing Requirements

Security is paramount since we will execute user-submitted code on the server. The system will implement multiple layers of sandboxing and resource control to ensure safe operation:

Docker Isolation: All custom node code and training jobs will run inside isolated Docker containers (or equivalent sandbox). This ensures that even if user code is malicious or buggy (infinite loop, trying to access system files, etc.), it cannot harm the host or other processes. Each execution spawns a fresh container (or uses a pool of pre-created containers) with a limited scope. The container images will be minimal and hardened – e.g., a Python image with only needed libraries, a Node image for JS, etc., each with non-root users. Once execution is finished, containers are stopped and removed to avoid persistence of any malicious changes.

Resource Limits: We will impose strict resource limits on the sandboxed execution. This includes CPU quotas (e.g. limit to 1 core or use CPU shares), memory limits (e.g. 256 MB or appropriate for the task), and execution timeouts (e.g. a node must complete within 10 or 30 seconds, or a training job maybe a few minutes, otherwise it’s terminated). These limits prevent a user’s code from monopolizing server resources or hanging indefinitely
GitHub
. For example, a node’s manifest could specify a 15s timeout and 256MB memory cap, and by default no network or filesystem access
GitHub
. The Docker run configuration will use flags like --memory, --cpu and we can leverage Docker’s built-in enforcement of those. The execution engine will also enforce timeouts in code (if a container doesn’t finish in time, force stop it). Logging of resource usage per run will help admins tune these limits.

Permission Restrictions: Inside the sandbox, the code will be run with minimal privileges. The container will not have access to the host filesystem (except perhaps a mounted volume for input data specific to that task). No secrets or credentials will be available in the environment unless explicitly provided for that task. Internet/network access from within containers will be disabled by default (most backtests should run on local data). If certain nodes legitimately need network (e.g. to fetch data), we will carefully allow only specific outbound requests (whitelisted domains or via a controlled proxy). This “least privilege” approach ensures that user code can’t call external services to exfiltrate data or trigger unwanted actions
GitHub
.

Code Validation: Before execution, we can perform some basic static analysis or validation on user code. For example, we might lint the code or restrict usage of dangerous modules. This is language-specific: in Python, we might disallow importing certain risky modules (os, subprocess) unless needed; in Node, restrict fs or child_process usage. WebAssembly modules by nature are sandboxed (no direct OS access), but we will also validate WASM binaries (e.g. ensure they don’t have excessive memory export). Additionally, the pipeline compiler will ensure that the outputs a node produces conform to the declared schema (using JSON Schema validation) which helps guard against malicious or accidental wrong data being passed along
GitHub
.

Authentication & Authorization: Ensure only authenticated users can access the system’s features. Use industry-standard auth (JWT, sessions, etc.) and always check user permissions on any action (e.g. a user can only run or edit their own pipelines, unless admin). This prevents one user’s data from being accessed by another. For observer roles, ensure their UI and API calls are read-only – the backend will enforce that they can’t execute runs or modify code.

Audit Logging: Keep audit logs of user actions (especially code execution). For each run, record which user initiated it, what code was run (reference to node versions), and resources used. This helps trace any incident (like if someone tried something malicious, we have an audit trail). Admins should be able to review these logs.

Infrastructure Security: The servers running the application should be secured – up-to-date OS patches, Docker daemon configured safely, etc. If this is deployed on cloud, use security groups, limit inbound access only to the web app, etc. Also, enforce HTTPS for the web UI to protect login credentials and data in transit.

Content Security (Browser): Since we allow editing and viewing code in the browser, we’ll ensure the app does not inadvertently execute any of that code on the client side (except WebAssembly if explicitly intended, but that should also be in a sandbox). Monaco editor is purely for text editing, so we must be cautious not to expose any XSS vectors. Use proper output encoding for any data displayed.

In summary, each custom node execution will be containerized with restricted CPU, memory, no external access, and closely monitored
GitHub
GitHub
. These sandbox and security measures will be in place from day one, as the goal is to ship iteratively but safely. We prefer to have slightly stricter limits initially (to be safe) and then loosen or adjust based on legitimate use cases.

7. Technical Stack & Architecture Overview

This section outlines the technologies and architecture choices for implementing the above requirements:

Front-End: The UI will be built with Svelte (a lightweight reactive framework) for a snappy user experience and ease of development. We’ll use TailwindCSS utility classes and the DaisyUI component library on top of it to achieve a consistent, modern design with minimal custom CSS. This choice accelerates development by providing ready-made styled components (buttons, forms, modals, etc.). The Monaco Editor (Microsoft’s VS Code editor component) will be integrated for the code editing areas – likely via an existing Svelte wrapper or a custom integration. Monaco provides out-of-the-box support for Python, JavaScript syntax highlighting, and can be extended for our DSL language. The front-end may be a Single-Page Application communicating with the backend via JSON APIs or it could use SvelteKit (which allows server-side rendering and endpoints). For simplicity, a SPA approach with Svelte and a separate REST API server is fine. We’ll structure the front-end into reusable components: e.g., <DslEditor>, <CodeEditor>, <NodeConfigPanel>, <ResultsChart> etc., to maintain clarity.

Back-End: We will likely use Node.js for the backend server, since much of our existing prototype logic (if based on HyperEdge code) is in TypeScript/Node. Node.js also eases integration of the JavaScript-based pipeline runner and can manage spawning Docker containers. We can use a framework like Express or SvelteKit’s server routes for APIs. Alternatively, a Python backend could be considered (especially since we’ll use Python for ML code execution), but maintaining two languages on backend might be overhead for a small team. Sticking to Node for core services (compiler, orchestrator) and using Python only inside the sandbox containers is a viable approach.

The Pipeline Compiler can be implemented in TypeScript (leveraging any existing data structures from the prototype). If the DSL is JSON-based (like the example in our internal docs), it may be directly parsed; if it’s a custom syntax, we might implement a parser or use a parsing library.

The Execution Engine orchestrator could also be in Node – it can call out to Docker via the Docker SDK or CLI. Node is non-blocking, allowing to monitor multiple containers asynchronously.

If needed, we might incorporate a task queue library (like Bull for Node or RQ for Python) for managing runs, but to start we can keep it simple.

Sandbox Runtimes: We will prepare Docker images for each environment:

A Node.js sandbox image (based on a slim Node Alpine image, for example) that contains our runner script to execute JS/WASM tasks. This could also include any common libraries needed for built-in nodes or convenience (though for JS, likely minimal).

A Python sandbox image (possibly derived from a Data Science image or minimal Python) with common ML/data libraries like pandas, numpy, scikit-learn, PyTorch, TensorFlow (the exact inclusion to be decided based on use – including both TF and PyTorch makes the image heavy; perhaps we maintain one base and allow extending or choose one for MVP).

We might consider a WASM runner – however, because WebAssembly is platform-agnostic, we could actually compile user code to WASM ahead of time and run it either in the Node container (using wasmtime or Node’s native WebAssembly support). Alternatively, provide a minimal WASM runtime container. For MVP, since writing custom WASM might be an advanced use-case, we can start with just Node and Python, and treat WASM as an advanced option (perhaps requiring manual upload of a .wasm file which the Node runner can load).

The communication between the main application and these containers could be handled by the main app invoking Docker commands (since containers are on the same host). For example, to run a Python node, the Node backend might execute: docker run --rm -m 256m -v /path/to/input.json:/input.json sandbox-python:latest python run_node.py /input.json /output.json. The input JSON contains node inputs/params, and the script writes outputs to output.json or prints to stdout. The backend then captures the result. We will design a simple protocol for passing data in/out of containers (likely JSON for structured data, maybe mounted files for larger data). In future, a more sophisticated service interface (like the container listening on a certain port for a run command) could be used, but file exchange or direct execution is sufficient initially.

Data & Storage Tech: We will use PostgreSQL as the primary database given its reliability and our likely need for complex queries (and it’s used in our current prototype). For file storage, if running locally or on a single server, we can use the filesystem with proper backups. If cloud-based, we might integrate AWS S3 or similar. Since this is a prototype, we can abstract the storage behind a service interface and switch implementations as needed.

External Integration: Integration with ML libraries is handled inside the sandbox containers (so no special external service needed for that, just ensure the libs are available). If in the future we integrate with external tools (like a cloud training service or a data source API), we would add those as needed. For now, external integration is minimal (perhaps just downloading data from a known URL if a node is configured to do so).

Architectural Diagram: In broad strokes, the architecture will look like this:

The client (browser) sends requests to the Web Server/API (Node.js).

When a run is initiated, the server invokes the Compiler (module) which produces a pipeline spec.

The server then hands this spec to the Execution Engine (could be within the same process or a separate service).

The Execution Engine coordinates with Sandbox Runner processes: launching Docker containers for each custom node execution (or possibly one container for the whole pipeline if we choose that model for simplicity, running all user code sequentially inside one container).

The results from execution are collected back by the engine, stored via the Storage system (DB and files), and streamed to the client.

Meanwhile, users can continue editing or even start multiple runs; the server can handle them in parallel limited by resource policies.

The architecture emphasizes modularity: e.g., the Monaco editor on front-end is decoupled from the actual running of code (which happens on backend in Docker), and the DSL is decoupled from execution logic (via the compiler step). This makes the system more maintainable and extensible (e.g., swapping DSL or adding new languages in sandbox).

Technical Risk & Mitigation: We note that supporting multiple languages (JS, Python, WASM) adds complexity. As a mitigation, we might implement one primary runner first (Node.js) and mark Python and WASM support experimental until next phases. The stack choices aim to minimize new, unproven tech: Svelte is straightforward for our team, Docker is well-known for sandboxing, and Monaco editor is a proven component. We will write thorough tests for the DSL compiler and a few example pipelines to ensure correctness.

8. Roadmap & Phased Delivery

To enable a small dev team to build and ship iteratively and safely, we will break the development into phases. Each phase delivers a usable subset of features, allowing for feedback and stabilizing before moving on.

Phase 1: MVP – Core Pipeline Editor & Execution

DSL Pipeline Editing (Minimal): Implement the DSL structure and a basic Monaco editor in the UI. In MVP, the DSL could even be a constrained JSON/YAML format or a very simple script syntax to reduce parser complexity. Ensure users can define a simple pipeline (e.g. data source → indicator → backtest node) via text.

Basic Node Library: Provide a set of built-in nodes (data loader, a couple of indicators, a simple execution/backtest node). These are hardcoded and tested components to allow a full pipeline run (e.g. CSV Data Source, SMA Indicator, Paper Trading Backtest node).

Pipeline Execution Engine: Develop the backend to parse the DSL and execute the pipeline. For MVP, we might limit to running everything in a single Node.js process for simplicity: custom logic can run in a Node sandbox (possibly using vm module or a simple Docker if ready). We will initially support JavaScript custom nodes only in this phase, since executing JS in Node is straightforward. Python and WASM nodes can be planned but might be stubbed or not exposed yet
GitHub
.

Monaco Editor Integration: Integrate Monaco for editing node code (JavaScript in this phase). Users can create a custom JS node via the UI, write code, and the system can execute it in the pipeline. Provide a basic template for node code (with a predefined function signature).

Run and Result Display: Implement the ability to run the pipeline from the UI and get results. In MVP, the results can be shown as raw text or simple tables (e.g. display the final equity or P&L, maybe a static chart image or minimal SVG chart for equity curve). The focus is to prove that a user can go from writing a strategy to seeing an outcome in one interface.

Sandboxing (Node.js): Use a limited sandbox for JS execution – for MVP, this could be Node’s built-in VM module with restricted globals, or a lightweight Docker container for Node if time permits. Ensure timeouts and memory limits are in place for safety, even if rudimentary (e.g. a manual timer to stop execution).

Single-User & Basic Auth: Possibly start with a single-user system (no login, or a hardcoded admin user) to reduce complexity. Alternatively, implement a simple username/password and treat everyone as a developer role in MVP.

Deployment & DevOps: By end of Phase 1, deploy the MVP app on a test server or local environment with Docker configured. Verify that a strategy developer can perform an end-to-end backtest with custom logic safely.

Phase 1 deliverable: A working prototype web app where a user can define a pipeline via DSL text, run a backtest on sample data, and view basic results. This will be demonstrated with a simple strategy (e.g. moving average crossover) to validate the flow.

Phase 2: Extended Languages & Features – Enhance capabilities and robustness

Python Node Support: Introduce the ability for custom nodes to be written in Python. This involves creating the Python sandbox Docker image with required libraries and updating the execution engine to route Python-based nodes to that environment. Users in the UI can choose a language for their node (Python or JS). Monaco can be set to Python mode for those nodes. We’ll test with an example (e.g. a custom indicator written in Python) to ensure it runs correctly.

WebAssembly Node Support: Allow users to upload or write nodes in WebAssembly. Possibly provide an example (like a Rust-compiled to WASM indicator) to test this. We might integrate a compile step for certain languages to WASM (not required if user provides the .wasm). The execution engine will load and execute WASM safely (likely via Node or a WASM runtime). This feature might be marked experimental and for advanced users.

Improved UI & UX: Enhance the UI based on feedback. For example, add an outline view of the pipeline for easier navigation, improve the styling and layout for the editor and results sections. Introduce additional DaisyUI components for better feedback (toasts for run start/finish, modals for confirmation). Possibly add a pipeline template gallery for new users (pre-written DSL for common patterns).

Result Visualization: Implement more robust visualization for results. This could include interactive charts (using a library like Chart.js or D3 via Svelte). The equity curve chart, distribution of returns, etc., could be added. Also, refine the results tables (sortable trades table, etc.). This will greatly improve the user’s ability to analyze the backtest outcomes.

Persistent Data & Model Handling: Finalize how datasets and model artifacts are handled. In Phase 2, implement the dataset upload feature (with UI to upload a CSV and select it in a data node). Also, when a model training node runs, save the model and allow the next nodes or future pipelines to use it. Possibly introduce a simple model registry in the UI (list of models, with metadata like date, pipeline origin). Ensure cleanup or space management (maybe not automatic in Phase 2, but at least admin visibility into storage usage).

Multi-User & Roles: Now enable full authentication and role separation. Users can sign up/login. Role-based access control is enforced: e.g. only Admin can access an “Admin Panel” where they see all pipelines, running processes, and system health. Observers can be created to share results – possibly implement a way to share a pipeline in read-only mode (e.g. generate a share link or add a user as observer to a project). This may require adding ownership fields and permission checks on the back-end routes.

Security Hardening: With more users and code running, invest in hardening the sandbox. Switch any remaining uses of the simple Node VM sandbox to full Docker isolation for consistency. Implement network egress restrictions properly on Docker containers (e.g. using Docker’s network settings or running containers in an isolated network). Add monitoring on the server for any container escapes or high resource usage. Possibly integrate basic policy checks – e.g. if a user tries to run a pipeline too frequently or uses too much data, require admin approval (simple thresholds to start).

Testing & Quality: By Phase 2, aim for a stable beta. Write comprehensive tests: unit tests for the DSL compiler (various pipeline definitions), integration tests for sample pipelines execution, and security tests for the sandbox (ensuring malicious code snippets are contained). Also test performance on sample large data (if processing say 1 year of minute bars, how does the system handle it, do we need optimizations?).

Phase 2 deliverable: A beta version of the application supporting both Python and JavaScript custom nodes, with an improved UI and robust backtesting capabilities. Users can upload their data, train basic models, and share results. The system will be secure for a wider group of users (with authentication and proper sandboxing in place).

Phase 3: Full Pipeline Support & Refinement – Production-ready features

Complete Feature Set: Add any remaining features to meet full requirements. For example, if not yet implemented, support conditional logic or loops in pipelines via DSL (if needed), or allow multiple pipelines to run sequentially/conditionally (e.g. one pipeline’s output feeding another – possibly out of scope, but consider if needed).

Plugin/Node Registry: Implement a registry for custom nodes (and possibly pipeline templates). This would allow users to publish a node they wrote so others can discover and use it. We would incorporate versioning (SemVer) for nodes, so a pipeline can pin to a version of a node
GitHub
. The registry could be as simple as a table of nodes marked public/shared. In the UI, add a library view where users can browse available nodes (built-in and shared). This promotes reuse and speeds up strategy development. Admins may moderate this library.

Scaling & Performance: Tackle any scaling needs. If many users or heavy workloads are expected, we might introduce job queues or container orchestration. For example, running containers on separate worker machines or using Kubernetes to manage resources. Ensure the system can handle multiple concurrent runs without slowdown. Optimize the execution engine and data handling (maybe stream data through pipeline instead of loading all into memory at once, etc.). Also, optimize the front-end for large pipelines (virtualize list displays, etc.).

Advanced Security & Policies: Introduce policy plugins or admin-set policies to govern usage. For instance, limit certain types of operations in user code (like accessing certain Python modules), enforce that all data outputs conform to schema (already done via validation) and perhaps scan code for known vulnerabilities. We can also add a feature for admins to preview or audit custom code before it runs (if needed in a multi-tenant environment). Possibly integrate an intrusion detection or simply more verbose logging and alerts for suspicious activities (e.g. if a code tries to open too many file handles or consumes unusual CPU, alert admin).

UI Polish and UX: Refine the user experience based on beta user feedback. This could include improving error messages (more user-friendly descriptions), adding inline documentation or help tips (e.g. tooltips or a help sidebar for DSL syntax and node reference). We should also ensure accessibility (keyboard shortcuts in the editor, proper labeling of UI elements for screen readers, etc. as feasible). If any UI components are still rudimentary (like our charting), consider upgrading them. For instance, integrate an interactive results dashboard where users can toggle which metrics to view, or zoom in on the equity curve.

Documentation & Tutorials: By Phase 3, provide comprehensive documentation: a user guide for the DSL (with examples), a guide on writing custom nodes (with examples in each language), and an admin guide for deploying and managing the system. Possibly embed some of this help into the app (like a “getting started” pipeline template or tutorial that runs a simple strategy). This will reduce support burden and help users self-serve.

Production Readiness: Finalize all aspects for a production release: rigorous testing (including chaos testing for sandbox escapes, load testing for performance), setting up backup routines for data, and monitoring/alerting on the server. Also, establish procedures for updating the system (especially if updating the Docker base images for security patches, etc.). If not already in use, Phase 3 might introduce container orchestration (K8s) for better production deployment, but that depends on scale.

Phase 3 deliverable: A production-ready application that fully supports complex pipelines with any mix of custom nodes in Python/JS/WASM, safe execution, and a rich user experience for strategy development and backtesting. The small dev team at this point will focus on maintenance, incremental improvements, and possibly preparing for broader use (more users or even commercialization, if that’s in the vision).

Throughout all phases, we prioritize iterative development, testing, and user feedback. Each phase builds securely on the last, ensuring we don’t compromise the system’s safety or stability while expanding features. By the end, the product will allow users to go from idea to strategy to backtest to model training in one seamless, web-based environment, with confidence in the isolation and integrity of their code and results.



Node-Based ML Strategy Pipeline Code Snippets

Below we provide code snippet examples for a node-based machine learning strategy pipeline, modeled after VishAlgo v4. The system uses a pipeline DSL to chain together pluggable “nodes,” each running inside a Docker sandbox (Python for ML logic, or potentially JavaScript/WebAssembly for other tasks). We include example implementations for each node type, an example pipeline definition (JSON-based), and explanations of how data flows between nodes in the Docker-based execution environment. Each node’s code contains placeholder logic that users can modify in the Monaco editor to customize behavior.

Data Loader Node (OHLCV Data Loader)

Purpose: Ingest historical OHLCV price data for a given instrument and time range, serving as the pipeline’s starting point. This could load from an API, database, or CSV file.

Inputs: None (or configuration parameters such as symbol, timeframe, date range).

Outputs: Price data (e.g. a Pandas DataFrame of timestamp, Open, High, Low, Close, Volume).

# DataLoaderNode.py (Python example)
class DataLoaderNode:
    def __init__(self, symbol: str, timeframe: str, start: str, end: str):
        self.symbol = symbol
        self.timeframe = timeframe
        self.start = start  # e.g. "2021-01-01"
        self.end = end      # e.g. "2021-06-01"

    def run(self):
        """Load OHLCV data for the specified symbol and date range."""
        import pandas as pd
        # Placeholder: load data (replace with API calls or DB queries as needed)
        filename = f"{self.symbol}_{self.timeframe}.csv"
        df = pd.read_csv(filename, parse_dates=['date'])
        # Filter by date range
        mask = (df['date'] >= self.start) & (df['date'] <= self.end)
        ohlcv_df = df.loc[mask].reset_index(drop=True)
        return ohlcv_df  # DataFrame with columns: date, open, high, low, close, volume


In the sandbox, this node’s code would run inside a Python Docker container (with pandas installed) and produce a DataFrame of OHLCV data. The output will be passed to the next node in the pipeline.

Feature Generator Node (Technical Indicators)

Purpose: Compute technical indicators or features from the price data (e.g., moving averages, RSI). This augments the dataset with additional columns used for ML model input.

Inputs: Price data (DataFrame) from the Data Loader.

Outputs: Feature data (DataFrame) – could be the same DataFrame with new feature columns or a separate feature matrix.

# FeatureGeneratorNode.py
class FeatureGeneratorNode:
    def __init__(self, features_config: list):
        # features_config might be a list of tuples specifying indicators and parameters
        # e.g., [("EMA", 14), ("RSI", 14)]
        self.features_config = features_config

    def run(self, price_df):
        """Compute technical indicators as new features."""
        import pandas as pd
        result_df = price_df.copy()
        for feature, period in self.features_config:
            if feature == "EMA":
                # Exponential Moving Average
                col_name = f"EMA_{period}"
                result_df[col_name] = price_df['close'].ewm(span=period).mean()
            elif feature == "RSI":
                # Relative Strength Index
                delta = price_df['close'].diff()
                gain = delta.clip(lower=0).rolling(window=period).mean()
                loss = (-delta.clip(upper=0)).rolling(window=period).mean()
                rs = gain / loss
                col_name = f"RSI_{period}"
                result_df[col_name] = 100 - (100 / (1 + rs))
            # ... add other indicators as needed
        return result_df  # DataFrame with new feature columns


This node runs after the Data Loader. In the pipeline, the orchestrator passes the OHLCV DataFrame into FeatureGeneratorNode.run(). The output DataFrame (now containing columns like EMA_14, RSI_14, etc.) is forwarded to subsequent nodes.

Labeling Node (Supervised Learning Target Generation)

Purpose: Create target labels for supervised learning (e.g., future price movement indicators). This node looks at future outcomes (like return over next N periods) to assign a label for each time step.

Inputs: Price data (DataFrame), typically the same OHLCV data (and possibly features) from earlier in the pipeline.

Outputs: Labeled data (DataFrame) – for example, the original DataFrame with an added label column indicating buy/sell/hold or 1/0 targets.

# LabelingNode.py
class LabelingNode:
    def __init__(self, horizon: int = 5, threshold: float = 0.02):
        # horizon: how many periods ahead to look for labeling
        # threshold: e.g., 0.02 = 2% price move threshold for classification
        self.horizon = horizon
        self.threshold = threshold

    def run(self, price_df):
        """Generate labels based on future returns."""
        df = price_df.copy()
        # Compute future return after `horizon` periods (percent change)
        df['future_return'] = (df['close'].shift(-self.horizon) / df['close']) - 1.0
        # Define label: 1 = future rise > threshold, -1 = future drop < -threshold, 0 = otherwise
        def categorize(fr):
            if fr is None:
                return 0  # for last few periods where future_return is NaN
            if fr > self.threshold:
                return 1   # buy signal
            elif fr < -self.threshold:
                return -1  # sell signal
            else:
                return 0   # hold/neutral
        df['label'] = df['future_return'].apply(categorize)
        return df  # DataFrame with new 'label' column


The Labeling node can run in parallel with feature generation (both depend on raw data). In the pipeline definition, this node might take the same input as the Feature Generator. Its output (labels for each time index) can be merged or passed alongside features to the Model Trainer node.

Model Trainer Node (Training an ML Model)

Purpose: Train a machine learning model (e.g., LSTM, TCN, CNN, or an ensemble) on the prepared features and labels. This node executes offline training inside a container (possibly with GPU support) and outputs a trained model artifact (file path or in-memory model reference).

Inputs: Feature data (typically a DataFrame or array of feature values) and corresponding labels.

Outputs: Trained model artifact (e.g., file path to saved model, or a model object/identifier).

# ModelTrainerNode.py
class ModelTrainerNode:
    def __init__(self, model_type="LSTM", epochs=10, **kwargs):
        # model_type could be "LSTM", "TCN", "CNN", etc. kwargs for hyperparameters
        self.model_type = model_type
        self.epochs = epochs
        self.kwargs = kwargs  # e.g., layers, units, learning_rate, etc.

    def run(self, feature_df, label_df):
        """Train an ML model on the given features and labels."""
        import numpy as np
        # Prepare training data (X for features, y for labels)
        X = feature_df.drop(columns=['date', 'label'], errors='ignore').values  # exclude non-feature columns
        y = label_df['label'].values if isinstance(label_df, dict) or 'label' in label_df else label_df

        # Placeholder: define a simple model based on model_type
        model = None
        if self.model_type == "LSTM":
            from tensorflow import keras
            model = keras.Sequential([
                keras.layers.Input(shape=(X.shape[1], 1)),          # assuming 1 feature sequence for simplicity
                keras.layers.LSTM(50),
                keras.layers.Dense(1, activation='sigmoid')        # binary classification (buy vs not-buy)
            ])
            model.compile(optimizer='adam', loss='binary_crossentropy')
        elif self.model_type == "CNN":
            # Example: a 1D CNN model placeholder
            from tensorflow import keras
            model = keras.Sequential([
                keras.layers.Input(shape=(X.shape[1], 1)),
                keras.layers.Conv1D(32, kernel_size=3, activation='relu'),
                keras.layers.GlobalMaxPooling1D(),
                keras.layers.Dense(1, activation='sigmoid')
            ])
            model.compile(optimizer='adam', loss='binary_crossentropy')
        elif self.model_type == "TCN":
            # Placeholder for a Temporal Convolutional Network model architecture
            pass  # (User can implement TCN architecture or use an existing library)
        else:
            # Other model types or ensemble logic
            pass

        # Train the model (using dummy data shape in this placeholder example)
        if model is not None:
            model.fit(X, y, epochs=self.epochs, verbose=0)
            model.save("trained_model.h5")  # Save model to a file in the container
        return "trained_model.h5"  # Return path to saved model (to be used by Inference node)


Note: In a real scenario, you would need to reshape X into sequences for LSTM/TCN models (e.g., using sliding windows on time-series data). The above is a simplified placeholder. The Monaco editor would allow users to modify the model architecture, loss function, etc., as needed.

This node would typically run in a Python container with ML frameworks (TensorFlow/PyTorch) installed. The container could be GPU-enabled for deep learning models. The output is a saved model file inside the container (the orchestrator would handle persisting or referencing this artifact for the next node).

Inference Node (Model Inference/Prediction)

Purpose: Use the trained model to generate predictions or signals on feature data. In backtesting, this might apply the model to historical features (e.g., walk-forward validation), whereas in live trading it would apply the model to incoming data in real-time.

Inputs: The trained model (from Model Trainer, e.g. a file path or model object) and current feature data (e.g. latest feature values or the feature DataFrame).

Outputs: Model predictions, e.g. an array of probabilities or signals, often appended to the data as a new column.

# InferenceNode.py
class InferenceNode:
    def __init__(self, model_path: str, output_field: str = "prediction"):
        self.model_path = model_path  # path to the trained model file
        self.output_field = output_field

    def run(self, feature_df):
        """Load the trained model and generate predictions on feature data."""
        import numpy as np
        from tensorflow import keras
        # Load the trained model (assuming Keras .h5 format for this example)
        model = keras.models.load_model(self.model_path)
        X = feature_df.drop(columns=['date', 'label', 'prediction', 'signal'], errors='ignore').values
        preds = model.predict(X)
        # If the model outputs probabilities or scores, we store them; do not threshold here
        feature_df = feature_df.copy()
        feature_df[self.output_field] = preds.flatten()  # e.g., probability of "buy"
        return feature_df  # DataFrame with a new 'prediction' column


The Inference node runs in a Python container with the same ML libs. It produces a prediction for each input data point (e.g., a probability between 0 and 1 for a long signal). We leave interpretation (buy/sell/hold decision) to the Gating node.

Gating Node (Signal Filtering & Thresholding)

Purpose: Apply rule-based logic to raw model predictions to decide final trade signals. For example, only issue a buy if the model confidence > X%, enforce a neutral “no trade” zone, or implement a cooldown between trades to avoid frequent flips. This corresponds to VishAlgo’s post-processing rules for signals
GitHub
GitHub
.

Inputs: Data with model predictions (e.g., a DataFrame including a prediction/probability column).

Outputs: Discrete trade signals (e.g., 1 for buy, -1 for sell, 0 for hold), typically added as a new column or as a separate list of signals.

# GatingNode.py
class GatingNode:
    def __init__(self, confidence_threshold: float = 0.6, cooldown: int = 0):
        self.confidence_threshold = confidence_threshold  # e.g., 0.6 = 60% confidence required
        self.cooldown = cooldown       # minimum bars between signals (to prevent over-trading)
        self._last_signal_index = None # track last signal index for cooldown enforcement

    def run(self, df):
        """Convert model predictions to trade signals based on threshold and rules."""
        df = df.copy()
        signals = []
        for idx, row in df.iterrows():
            prob = row.get('prediction', None)
            if prob is None:
                signals.append(0)
                continue
            signal = 0  # default hold
            # Example rule: if probability > threshold => buy signal, if < (1 - threshold) => sell signal
            if prob >= self.confidence_threshold:
                # Check cooldown: only signal if no recent signal in last `cooldown` bars
                if self._last_signal_index is None or (idx - self._last_signal_index) > self.cooldown:
                    signal = 1   # generate a BUY signal
                    self._last_signal_index = idx
            elif prob <= (1 - self.confidence_threshold):
                if self._last_signal_index is None or (idx - self._last_signal_index) > self.cooldown:
                    signal = -1  # generate a SELL signal
                    self._last_signal_index = idx
            # If in between thresholds, remain 0 (no trade)
            signals.append(signal)
        df['trade_signal'] = signals
        return df  # DataFrame with a new 'trade_signal' column (1, -1, or 0)


In this example, the gating logic issues a buy (1) if model prediction ≥ 0.6, a sell (-1) if prediction ≤ 0.4 (i.e., 1 - 0.6), and holds (0) otherwise. A cooldown parameter enforces at least N bars between signals (to avoid rapid successive trades). Users can adjust these rules in the editor as needed (e.g., implement neutral zones, time-of-day filters, etc.). This corresponds to VishAlgo’s practice of filtering signals by confidence and adding delays
GitHub
.

Risk Sizer Node (Position Sizing & Risk Management)

Purpose: Determine position size and apply risk management rules for each trade signal. This node translates a signal (buy/sell) into an order quantity based on account capital, risk appetite, or other constraints. It can also attach stop-loss/take-profit levels or cap the exposure per trade, similar to VishAlgo’s sizing and risk controls
GitHub
.

Inputs: Trade signals (from the Gating node) and possibly market data (price) and account state (capital).

Outputs: Order specifications for each signal (e.g., with side, size, price, and risk parameters).

# RiskSizerNode.py
class RiskSizerNode:
    def __init__(self, max_risk_pct: float = 0.05, capital: float = 100000.0, stop_loss_bps: int = None, take_profit_bps: int = None):
        # max_risk_pct: fraction of capital to risk per trade (e.g., 0.05 = 5%)
        # stop_loss_bps, take_profit_bps: optional risk limits in basis points (1/100 of a percent)
        self.max_risk_pct = max_risk_pct
        self.capital = capital
        self.stop_loss_bps = stop_loss_bps
        self.take_profit_bps = take_profit_bps

    def run(self, df):
        """Convert trade signals into sized orders with risk limits."""
        df = df.copy()
        orders = []  # will hold order dicts or None for no order
        for idx, row in df.iterrows():
            signal = row.get('trade_signal', 0)
            if signal == 0:
                orders.append(None)  # no trade
            else:
                # Determine dollar value to allocate to this trade
                allocation = self.capital * self.max_risk_pct
                price = row['close'] if 'close' in row else None
                if price is None:
                    size = allocation  # if price not available, use allocation as size (e.g., in quote currency)
                else:
                    size = allocation / price  # position size in units of asset
                order = {
                    "side": "BUY" if signal > 0 else "SELL",
                    "size": size,
                    "price": price,
                    "time": row.get('date', None)
                }
                # Attach optional stop-loss/take-profit based on bps if provided
                if price and self.stop_loss_bps:
                    order["stop_loss_price"] = price * (1 - self.stop_loss_bps/10000.0)  # e.g., 50 bps = 0.5%
                if price and self.take_profit_bps:
                    order["take_profit_price"] = price * (1 + self.take_profit_bps/10000.0)
                orders.append(order)
        df['order'] = orders  # each entry is an order dict or None
        return df  # DataFrame with a new 'order' column


In this example, for each trade_signal the Risk Sizer computes an order dictionary. We allocate max_risk_pct of capital to the trade; e.g. with $100k capital and 5% risk, each trade is ~$5k. If the price is $50, size = $5k/$50 = 100 units. We also illustrate how to set a stop-loss or take-profit price (in basis points). Users can modify this logic to include more complex risk management (max positions, trailing stops, etc.).

Execution Node (Trade Execution & Backtest Simulation)

Purpose: Execute the orders produced by the Risk Sizer. In backtesting mode, this node simulates trades on historical data (accumulating PnL, etc.). In live mode, it would route orders to an exchange or broker API. This is the pipeline’s end-point that turns signals into actual trades or simulated outcomes
GitHub
.

Inputs: Orders with details (from Risk Sizer), and possibly mode settings (backtest or live).

Outputs: Executed trades or performance metrics (e.g., list of executed trades, or a report of the backtest).

# ExecutionNode.py
class ExecutionNode:
    def __init__(self, mode: str = "backtest", exchange: str = None):
        # mode: "backtest" or "live"
        # exchange: identifier for exchange or broker (for live trading)
        self.mode = mode
        self.exchange = exchange

    def run(self, df):
        """Execute orders: either simulate (backtest) or send to exchange (live)."""
        executed_trades = []
        position = 0
        pnl = 0.0
        for idx, row in df.iterrows():
            order = row.get('order')
            if order is None:
                continue  # no trade at this index
            side = order["side"]
            size = order["size"]
            price = order["price"]
            timestamp = order.get("time")
            if self.mode == "backtest":
                # Simulate trade fill
                if side == "BUY":
                    position += size  # add long position
                    pnl -= size * price  # spend cash
                elif side == "SELL":
                    position -= size  # reduce position (or go short)
                    pnl += size * price  # receive cash
                # (In a full backtester, we'd also calculate PnL for closing trades, slippage, fees, etc.)
            else:
                # Live trading: send order to real exchange via API (placeholder)
                print(f"[LIVE] Executing {side} order for {size:.4f} units at ${price:.2f} on {self.exchange}")

            executed_trades.append({
                "time": timestamp,
                "side": side,
                "size": size,
                "price": price
            })
        # After loop, for backtest mode, you might calculate final PnL if position closed, etc.
        return executed_trades  # list of executed trade records (or could update df with results)


For backtesting, the Execution node walks through each time step, “fills” the orders, and updates a simulated position and P&L. (A more sophisticated backtester could mark trades at next-bar open, apply slippage/commission, and produce performance metrics.) For live trading, this node would use the provided exchange API to place orders – here we just print an example API call. The output could be a list of executed trades or performance stats; developers can adapt this to their needs.

Pipeline Definition Example (DSL/JSON)

The entire strategy pipeline is typically defined in a DSL script or a JSON configuration that the system can interpret. Below is an example in JSON form, listing each node in order and how they connect. This pipeline covers an end-to-end flow: Data loading, feature computation, labeling, model training, inference, gating, sizing, and execution.

{
  "pipeline": [
    {
      "id": "node1",
      "type": "DataLoaderNode",
      "params": { 
        "symbol": "BTC/USD", 
        "timeframe": "1h", 
        "start": "2021-01-01", 
        "end": "2021-06-01" 
      }
    },
    {
      "id": "node2",
      "type": "FeatureGeneratorNode",
      "depends_on": ["node1"],
      "params": { 
        "features_config": [ ["EMA", 14], ["RSI", 14] ] 
      }
    },
    {
      "id": "node3",
      "type": "LabelingNode",
      "depends_on": ["node1"],
      "params": { 
        "horizon": 5, 
        "threshold": 0.02 
      }
    },
    {
      "id": "node4",
      "type": "ModelTrainerNode",
      "depends_on": ["node2", "node3"],
      "params": { 
        "model_type": "LSTM", 
        "epochs": 5 
      }
    },
    {
      "id": "node5",
      "type": "InferenceNode",
      "depends_on": ["node4", "node2"],
      "params": { 
        "model_path": "trained_model.h5" 
      }
    },
    {
      "id": "node6",
      "type": "GatingNode",
      "depends_on": ["node5"],
      "params": { 
        "confidence_threshold": 0.6, 
        "cooldown": 3 
      }
    },
    {
      "id": "node7",
      "type": "RiskSizerNode",
      "depends_on": ["node6"],
      "params": { 
        "max_risk_pct": 0.05, 
        "capital": 100000, 
        "stop_loss_bps": 50, 
        "take_profit_bps": 100 
      }
    },
    {
      "id": "node8",
      "type": "ExecutionNode",
      "depends_on": ["node7"],
      "params": { 
        "mode": "backtest", 
        "exchange": "SIM" 
      }
    }
  ]
}


In the above JSON:

Each node has a unique id.

The type corresponds to the node class/implementation.

depends_on denotes dependencies (which node outputs feed into this node). For example, the FeatureGeneratorNode depends on the DataLoader’s output, and the ModelTrainerNode depends on both the feature data (node2) and labels from the labeling node (node3). The pipeline engine uses these to determine execution order and what data to pass where.

params provides configuration for each node (matching the __init__ arguments in our code snippets).

This structured definition could be the behind-the-scenes representation of a visual canvas or a DSL script. (In fact, the HyperEdge platform stores the node graph as JSON/YAML under the hood
GitHub
.) At runtime, the system will parse this pipeline, validate connections, and then execute each node in sequence (respecting dependencies).

Pipeline Execution and Docker Sandbox Architecture

Each node’s code (which the user can edit in the Monaco editor) is executed in an isolated Docker container appropriate to its language/runtime. Here’s how the orchestration and data flow work:

Code Organization: Each node type might correspond to a script or class (like our .py files above). These are saved on the server when edited. The system knows which language a node is implemented in (e.g., Python for our examples; potentially Node.js for a JavaScript node or a WASM binary for a WebAssembly node).

Orchestration: When a user runs a pipeline, an orchestrator service reads the pipeline definition (like the JSON above) and resolves the execution order (a directed acyclic graph of nodes). It then executes nodes one by one (or in parallel where possible) inside container sandboxes:

For a Python node, the orchestrator might launch a Docker container from a base image (with necessary libraries like pandas, numpy, TensorFlow, etc. pre-installed). The node’s code is injected into the container (e.g., mounted as a file or passed as a Python snippet to run).

The orchestrator provides the node’s input data to the container. For example, it may serialize the DataFrame from the Data Loader node to a file (CSV/JSON or a pickle) or through STDIN.

The container runs the node’s run() method or equivalent, reading the input and producing output. The output might be saved to a temporary file or emitted via STDOUT, which the orchestrator captures.

The container then terminates (keeping the environment ephemeral and isolated).

Data Passing Between Stages: The output of each node is passed as the input to its dependent nodes:

If both nodes are in Python, the DataFrame or Python object can be serialized (e.g., using pickle or JSON) and then deserialized in the next container.

For cross-language transitions (say a JavaScript node following a Python node), a common serialization format like JSON is used. For instance, a Python DataFrame could be converted to JSON records or CSV, then the JS node reads that and processes it.

The orchestrator handles this data conversion. In our example pipeline, after DataLoaderNode completes, the orchestrator would take the returned DataFrame (OHLCV data) and provide it to FeatureGeneratorNode and LabelingNode (since both depend on the raw data). Once they produce outputs, the ModelTrainerNode receives both the feature set and labels (the orchestrator matches depends_on: it might pass two inputs into the run() method of ModelTrainer, as we designed run(self, feature_df, label_df)). Similarly, InferenceNode gets the trained model artifact and feature data, and so on.

Internally, the pipeline might maintain an in-memory context or a temporary data store keyed by node ID, to store outputs for later nodes. For example, after node2 and node3, the orchestrator has output[node2] = feature_df and output[node3] = labeled_df. When node4 (ModelTrainer) runs, it retrieves those outputs for use.

Sandboxing and Security: Running each node in a Docker container ensures that user-provided code (from the Monaco editor) is isolated. It cannot affect the host system and is limited in resources (CPU, memory, etc.) per container. This also allows using different runtimes as needed (e.g., a Node.js container for JavaScript nodes, a Wasm runtime for WebAssembly nodes).

Execution Flow: The pipeline execution is typically synchronous stage by stage for a backtest/training job. For live trading, a similar pipeline might be deployed such that the Data Loader continuously fetches new data and flows through the chain in streaming mode (likely using a long-running service with the same node logic, rather than one-off batch containers).

Logging & Monitoring: Each node can log its actions (e.g., training progress, or number of signals generated). The orchestrator can capture these logs (perhaps relayed to the UI via WebSocket for real-time monitoring). In backtest mode, after the Execution node finishes, the system could compile a report of the strategy’s performance (P&L, Sharpe ratio, etc.), possibly by having an additional Metrics/Evaluator node or by the orchestrator summarizing the executed_trades. (HyperEdge’s design mentions adding analytics nodes for performance metrics
GitHub
.)

Customizing Nodes via Monaco Editor

All the code snippets above are intended as templates. They include simple, placeholder logic (e.g., a basic RSI calculation, a trivial LSTM model architecture, simple PnL simulation). In the web application, each node’s code can be edited using the Monaco Editor to extend or replace this logic. For example:

A user might open the Feature Generator node in Monaco and add a new technical indicator calculation or use a library like TA-Lib for more complex features.

In the Model Trainer node, the user could experiment with different model architectures (say, changing from an LSTM to a Transformer, or adjusting hyperparameters).

The Gating node’s code could be modified to implement different signal confirmation logic (e.g., require multiple consecutive predictions before a trade, or incorporate external conditions).

The Risk Sizer node could be adjusted to use dynamic position sizing (e.g., based on volatility or available cash).

The Execution node could be extended to record detailed backtest stats or to integrate with a specific exchange’s API for live orders.

Because each node runs in a Docker sandbox, users have the flexibility to import additional Python/JS libraries (if added to the environment) or write arbitrary code, without affecting other parts of the system. The visual pipeline DSL ties these custom nodes together. Before execution, the system ensures the pipeline is configured correctly (e.g., all dependencies satisfied, data types compatible)
GitHub
, then launches the sandboxed jobs.

Summary: The above examples demonstrate a full ML strategy pipeline: from data ingestion, through feature engineering and label creation, to model training, inference, signal gating, risk management, and execution. The nodes are modular and connected via a DSL/JSON pipeline definition. At runtime, an orchestrator spins up containerized node instances in sequence, passing data along (using common formats) and thereby training and backtesting the strategy. All node implementations are editable, allowing a development team to refine each step’s logic in the Monaco editor and quickly test the pipeline in the sandboxed environment. This design leverages the HyperEdge/VishAlgo concept of a visual strategy canvas with pluggable blocks
GitHub
GitHub
, enabling rapid iteration on complex ML-driven trading strategies. Each code snippet here can serve as a starting point for implementation and can be expanded as needed for the team’s specific use cases.


Scope assumptions (for MVP)
Frontend: Svelte + Tailwind + DaisyUI with Monaco editor
DSL-based pipeline editing and validation
Built-in nodes (CSV Data, SMA Indicator, Backtest)
Execution engine running pipelines; JS custom nodes supported
Basic run status, logs, metrics, and simple charts
Single-user or basic auth; roles deferred
Python/WASM support deferred beyond MVP
Release cadence
Sprint length: 2 weeks
Team size assumed: 2–4 devs
Target MVP after 3 sprints
Sprint 1 – Seed a runnable strategy and results
Sprint goal: A user can open the app, load a sample DSL pipeline, run a backtest on bundled sample data, and see basic results.

User stories (each 1–2 days):

As a strategy developer, I can open a web app and view a list with a preloaded sample pipeline.
Acceptance:
Given I load the app
When I visit Pipelines
Then I see “Moving Average Crossover (Sample)” and can open it in an editor
As a developer, I can view and edit the pipeline DSL in Monaco with syntax highlighting (basic).
Acceptance:
Given the DSL editor is open
When I type recognized keywords/nodes
Then I see syntax highlighting and can save changes
As a developer, I can run the sample pipeline and get a success/fail toast with a run ID.
Acceptance:
Given a valid sample DSL
When I click Run
Then a run starts and I receive a run ID and final status
As a developer, I can view a results summary (P&L, return %, Sharpe placeholder, trade count) after the run.
Acceptance:
Given a completed run
When I open Results
Then I see summary metrics and a trades count sourced from the run output
As a developer, I can see a simple run status indicator and basic logs (final output or error text).
Acceptance:
Given a running or failed run
When I open the run detail
Then I see status (Running/Completed/Failed) and captured logs/stdout or error
As a developer, I can run the pipeline on bundled sample CSV data (no upload yet).
Acceptance:
Given the sample DSL references “sample_ohlcv.csv”
When I run
Then execution succeeds using that dataset and produces metrics
As an observer, I can view a read-only results page shared via direct link (temporary simple share).
Acceptance:
Given a completed run
When I open a shareable URL
Then I can see results but cannot edit or run anything
Demo: Open app → open sample DSL → run → watch status → view summary metrics and a basic log.

Sprint 2 – Validated pipelines and clearer results
Sprint goal: Users get helpful DSL validation, a compiler-backed executable graph, a visible equity curve, and a minimal run history.

User stories (each 1–2 days):

As a developer, I get immediate DSL syntax errors with squiggles and line messages.
Acceptance:
Given invalid DSL
When I type a malformed node block
Then I see inline errors and a panel entry with line/column
As a developer, I get semantic validation for node references, params, and type compatibility.
Acceptance:
Given a pipeline referencing unknown node types or missing params
When I validate or try to run
Then I see specific semantic errors with node IDs and fields
As a developer, the DSL compiles to an IR (JSON graph) visible in a “Compiled” tab.
Acceptance:
Given valid DSL
When compiled
Then I can view the JSON IR listing nodes, params, and depends_on links
As a developer, I can see an equity curve chart for completed runs.
Acceptance:
Given a completed run with equity/time series
When I open results
Then I see an interactive line chart (hover values, simple zoom or toggle)
As a developer, I can cancel a running pipeline.
Acceptance:
Given a running run
When I click Cancel
Then the run stops and the status is Canceled, no further charges to metrics
As a developer, I can see a run history per pipeline and open prior results.
Acceptance:
Given multiple past runs
When I open Run History
Then I see timestamped runs, status, summary metrics preview, and can open details
As a developer, I can upload a CSV dataset and select it in the DSL via a friendly picker.
Acceptance:
Given a CSV upload UI
When I upload valid OHLCV data
Then I can reference it in the DSL (or choose from a dataset dropdown) and run successfully
Demo: Show invalid DSL feedback → fix and compile → run → cancel demo → run to completion → show equity chart and open a previous run from history → upload CSV and rerun.

Sprint 3 – Custom JS nodes and safe execution
Sprint goal: Users can author custom JavaScript nodes in Monaco, run them safely with timeouts/limits, manage nodes, and save pipeline versions.

User stories (each 1–2 days):

As a developer, I can create a custom JS node from a template, edit in Monaco, and save it.
Acceptance:
Given a Node Library
When I click New Node (JS)
Then a template with a run(input) signature opens, I can save with a name, and it’s listed
As a developer, I can add my custom JS node to a pipeline via DSL and run end-to-end.
Acceptance:
Given a custom node
When I reference it in DSL and run
Then the engine executes it and its output impacts downstream results
As an admin/developer, custom JS node execution is sandboxed with CPU/memory/time limits.
Acceptance:
Given a node with an infinite loop or heavy memory allocation
When I run
Then execution is terminated per timeout/memory threshold and the UI shows a controlled error
As a developer, I can see console/log output from a custom node in run logs.
Acceptance:
Given a custom node that logs progress
When I run
Then the logs panel shows the node’s log lines tagged by node ID
As a developer, I can version pipeline definitions and restore a prior version.
Acceptance:
Given multiple saves
When I open Version History
Then I can diff titles/timestamps and restore a prior version which loads in the editor
As a developer, I can duplicate a pipeline to fork experiments.
Acceptance:
Given a pipeline
When I click Duplicate
Then a new pipeline is created with the same DSL and assets, editable independently
As an observer, I can open read-only DSL and results (UI enforces read-only).
Acceptance:
Given an observer link
When I open the pipeline page
Then the editor is non-editable; Run button hidden; results viewable
As a developer, I can export a run’s artifacts (CSV of trades, metrics JSON).
Acceptance:
Given a completed run
When I click Export
Then I download trades.csv and metrics.json reflecting that run
Demo: Create a custom JS node → reference in DSL → run safely (show logs and limits) → show pipeline versioning → export artifacts and open read-only link.

Post-MVP (backlog candidates)
Python node support via Docker sandbox (with ML libs)
Advanced charts and analytics
Auth and roles (Admin/Observer with RBAC)
WASM node support
Node registry with versioning and sharing
Dataset quotas and storage monitoring
Real-time log streaming and richer run timeline
Cross-cutting agile practices
Definition of Done: Story meets acceptance criteria; unit/integration tests where applicable; basic logging; error states handled; UX accessible and responsive; documented in UI help or tooltips.
Environments: Dev/staging with seeded sample data; minimal CI to lint/build/test; nightly e2e smoke for sample pipeline.
Risk management:
DSL complexity → start with constrained grammar; expand iteratively.
Sandbox escapes/perf → start with strict limits; test malicious snippets; observe and tune.
Data variability → validate dataset shape; give clear error messages and examples.
MVP release criteria
Author, edit, validate, and run a pipeline with built-in nodes using uploaded CSV or sample data
Create and run custom JS nodes safely (time/memory/timeout enforced)
View status, logs, summary metrics, and equity curve; export key artifacts
Persist pipelines, runs, datasets; basic share/read-only path
Completion summary: The plan structures three sprints to achieve an MVP aligned to your PRD’s Phase 1, ensuring each story provides end-to-end user value and is sized to 1–2 days for a small team.