Thanks! I’ll compile a recommended set of coding standards and best practices tailored to your stack: Svelte for the frontend, Node.js with Fastify for the backend, and PostgreSQL for the database. I’ll include widely accepted style guides, naming conventions, code organization, and linting tools for each layer.

I’ll let you know when it’s ready for your review.


# Coding Standards and Best Practices for Svelte, Node (Fastify), and PostgreSQL

## Frontend (Svelte)

### Code Style and Formatting

* **Indentation and Structure:** Use consistent 2-space indentation in Svelte files. Organize each component file with the `<script>` section first, then the HTML markup, and `<style>` last, separated by blank lines for clarity. This makes the code easier to read and maintain.
* **Consistent HTML Formatting:** Write clean, well-formatted HTML in Svelte components. Ensure that nested elements are properly indented and multiline elements are clearly separated. Use self-closing tags where appropriate and keep attribute formatting consistent.
* **CSS Styling:** Scope styles to the component whenever possible (using Svelte’s default scoped styles). Format CSS with consistent rules (e.g., kebab-case for class names, a blank line between rule sets) to maintain readability.
* **Prettier Formatting:** Utilize Prettier (with the Svelte plugin) to automatically format your Svelte files. Prettier will handle consistent spacing, quote usage, etc., across your HTML, CSS, and JavaScript code in Svelte components. This reduces bikeshedding over style and enforces a uniform style project-wide.

### Naming Conventions

* **Component Names:** Use **PascalCase** for Svelte component file names and component tags (e.g. `Header.svelte`, used as `<Header/>`). This follows the convention that Svelte components are capitalized, making them easily distinguishable in markup.
* **Variables and Props:** Use **camelCase** for JavaScript variables and component props, following standard JavaScript conventions. For example, `let isModalOpen = false;` or a prop `export let userName;`. Use clear, descriptive names that reflect the variable’s purpose.
* **Stores and Modules:** Name Svelte store modules in a concise, lowercase manner. For instance, a store file might be `tasks.js` exporting a `tasks` store. This helps indicate that the file is not a component but a plain JS module (often placed in a `src/stores` directory).
* **CSS Classes:** Use **kebab-case** (dash-separated) for CSS class names in Svelte components. This is a common CSS convention and helps avoid conflicts. For example: `<div class="menu-item">...</div>`.
* **File and Directory Names:** Outside of component files, use lowercase and dashes or underscores consistently for filenames (e.g. utility modules or store files). Follow a convention and stick to it throughout the project (for example, `api-client.js` or `api_client.js`, but not mixing styles).

### Directory and File Organization

* **Project Structure:** Keep all Svelte source code under a `src/` directory for clarity. Within `src`, organize files by feature or domain rather than by file type. For example, group related components in a folder (e.g. `src/components/auth/Login.svelte`, `src/components/auth/Signup.svelte` in an `auth` folder) for better modularity.
* **Components and Libs:** Use a `components/` directory (or SvelteKit’s `routes` structure if applicable) to store UI components. Consider grouping components by feature or section of the app. SvelteKit projects often use `src/lib` for shared components or utilities.
* **Stores and Utilities:** Keep application state management in a dedicated `stores/` folder. Similarly, place utility functions or helper modules in a `utils/` or `lib/` directory. This separation makes it easy to locate stateful logic vs. presentational components.
* **Static Assets:** Place static assets such as images or global styles in a `static/` or `public/` directory (as per SvelteKit conventions). This keeps non-code assets separate from component code. For example, use `static/images/…` for image files referenced in components.
* **File Naming:** Match component file names to their default export (the component name) for clarity. Avoid very long filenames; be concise but descriptive. Directory names should reflect feature areas (e.g. `dashboard/`, `profile/`) which contain the components, stores, and styles related to that feature.

### Documentation and Comments

* **Commenting Components:** Include comments in your Svelte components to explain non-obvious logic. For instance, if a block of code is doing something complex or has a workaround, add a brief comment above it. This is especially useful for other developers (or your future self) to quickly grasp intent.
* **JSDoc for Functions:** If you have utility functions or complex logic in the `<script>` of a component (or in separate `.js`/`.ts` modules), consider using JSDoc comments to document the function’s purpose, parameters, and return values. For example:

  ```js
  /** 
   * Filters the task list to only active tasks.
   * @param {Task[]} tasks - List of task objects.
   * @returns {Task[]} Active tasks.
   */
  function getActiveTasks(tasks) { … }
  ```

  Such comments serve as both documentation and type hints (especially if using TypeScript).
* **Component API Documentation:** When creating reusable components, document their API (props, events, slots). You can add a top-of-file comment in the component file listing its expected props and events. For example:

  ```svelte
  <!-- 
    Modal.svelte: A generic modal component.
    Props: 
      - open (boolean): whether the modal is open.
      - title (string): modal title text.
    Events:
      - close: dispatched when the modal requests to close.
  -->
  <script> … </script>
  ```

  This helps consumers of the component understand how to use it without reading its entire implementation.
* **Avoid Redundant Comments:** Do not clutter the code with comments that restate the obvious (e.g., `i++; // increment i`). Instead, focus on why something is done if it’s not immediately clear. Keep comments up-to-date as code changes to avoid confusion.

### Recommended Linting and Formatting Tools

* **ESLint:** Use ESLint to catch code issues and enforce style. The official Svelte ESLint plugin (`eslint-plugin-svelte`) integrates Svelte with ESLint. ESLint helps flag problematic patterns and maintain code quality; it’s considered the de-facto standard for JS linting. Configure a base ruleset (Airbnb, Standard, or Svelte’s recommended rules) and add Svelte-specific rules. This will, for example, catch unused variables in `<script>` or accessibility issues in your markup.
* **Prettier:** Set up Prettier with the Svelte plugin for automatic code formatting. Prettier will format Svelte files (scripts, markup, styles) on save or commit, ensuring a consistent style (quotes, spacing, wrapping) across the codebase. This removes stylistic debates and lets developers focus on functionality.
* **svelte-check (TypeScript):** If using TypeScript or want extra assurance, use `svelte-check` (part of Svelte’s Language Tools) to statically analyze your Svelte components for type errors and best practices. This can catch errors like incorrect prop types or unused CSS classes.
* **VSCode Extensions:** If using VSCode, install the official Svelte extension, which includes syntax highlighting, intellisense, and integrates with ESLint/Prettier. Also consider the Prettier extension to format on save. Ensure your project has configuration (`.eslintrc.cjs`, `.prettierrc`) checked in so all developers adhere to the same settings.
* **Continuous Integration:** Incorporate linting and formatting checks in your CI pipeline. For example, run `eslint .` and `prettier --check .` on pull requests. This ensures that code merged into the repository meets the style and quality guidelines automatically.

### Testing Standards and Frameworks

* **Unit Testing Components:** Utilize a testing framework like **Jest** or **Vitest** with Svelte Testing Library to unit test Svelte components. Each component should have tests for its logic and rendering for various states. Svelte Testing Library provides utilities to render components and simulate user interaction, encouraging tests that resemble real usage.
* **Integration/UI Testing:** For higher-level testing of the frontend, use a tool like **Playwright** or **Cypress**. These can simulate a browser and test user flows in the Svelte app. For example, with Playwright you can render the built app and verify that navigating to certain pages or clicking buttons produces the expected results. This is especially useful for SvelteKit applications (server-rendered pages, routing, etc.).
* **Testing Practices:** Follow good testing practices such as writing tests that are independent and clear in their purpose. Aim for a mix of tests: component tests (isolated), store logic tests (for complex stores), and end-to-end tests (covering integration of frontend with backend if possible). Consider writing tests before implementing features (TDD) to clarify requirements, but at minimum ensure each bug fix or feature comes with corresponding tests.
* **Snapshot Testing:** Where appropriate, use snapshot tests for components to catch unexpected changes in output. Svelte’s output can be serialized to JSON or HTML and compared. However, use snapshots judiciously – they are best for presentational components. Always review snapshot diffs to ensure changes are intentional.
* **Test Coverage:** Measure test coverage and strive to cover critical parts of your Svelte app (business logic in stores, rendering logic in components). If using Jest or Vitest, you can use their coverage tools (e.g., Istanbul via `--coverage`) to identify untested files. Aim for a high coverage percentage, but focus more on meaningful tests than the number itself.

### Security Best Practices

* **XSS Protection:** Svelte automatically escapes expressions in the template, preventing most XSS by default. **Do not** bypass this unless necessary. If you must inject raw HTML (using Svelte’s `{@html ...}` tag), **only do so with trusted content** and preferably sanitize it first. Remember that using `@html` is dangerous and should be paired with XSS sanitization libraries or very trusted input. Avoid inserting user-provided strings directly into `@html` without cleaning.
* **Content Security Policy (CSP):** Implement a Content Security Policy in your app (especially if using SvelteKit) to mitigate XSS and other attacks. SvelteKit supports setting CSP headers or meta tags via configuration. A strict CSP (e.g., defaulting to self for scripts/styles, with nonces or hashes for any inline code that Svelte injects) can prevent unauthorized scripts from running. This adds a strong layer of defense in depth.
* **Avoid Leaking Sensitive Data:** Never hardcode secrets (API keys, tokens) in your frontend code – remember, anything in the frontend is visible to end users. Use environment variables on the build process or rely on your backend for sensitive operations. For example, if you have a Firebase or third-party key that must be in the frontend, restrict its permissions on the server side as much as possible.
* **Secure Dependencies:** Keep front-end dependencies updated to patch known vulnerabilities. Use tools (like `npm audit` or GitHub’s dependabot) to alert on vulnerable packages. If a Svelte-related package has a security issue, update it promptly.
* **Additional Frontend Safeguards:** Validate and sanitize any data that comes from or goes to the backend. While the backend should enforce validation, adding client-side checks (e.g., form input validation) helps provide a better user experience and reduces malformed requests. Also, be cautious with third-party scripts or libraries – host critical libraries yourself or pin versions to avoid supply-chain attacks, and include Subresource Integrity (SRI) hashes if loading from CDNs.

### Performance Best Practices

* **Minimize Re-rendering:** Take advantage of Svelte’s reactivity to update only what's necessary. Avoid overly broad reactive statements. For example, use `$:` wisely – limit its scope so that it only runs when needed. Do not cause side effects inside reactive blocks that trigger additional renders. This prevents performance bottlenecks due to unnecessary recalculation.
* **Component Design:** Keep components small and focused. Large monolithic Svelte components can become slow to update. Break down complex UIs into smaller components where each handles its own state; this also allows Svelte’s compiler to optimize updates. Reuse components when possible instead of duplicating logic. Also utilize Svelte’s `<svelte:component>` for dynamic component rendering to avoid big `if/else` trees in the DOM – it can reduce DOM churn when switching views.
* **Dynamic Imports (Code Splitting):** Leverage code-splitting for large modules or components not needed at initial load. In SvelteKit, routes are code-split by default. For manual control, use dynamic `import()` to lazy-load hefty components (like a large chart or a modal) only when they are needed. This reduces initial bundle size and improves first load performance.
* **Optimizing Assets:** Optimize static assets used in Svelte components. For images, use modern formats (WebP/AVIF) and responsive techniques (the `<picture>` element or SvelteKit’s image optimization if available) to serve appropriately sized images. Compress images and videos – large media can slow down your app significantly. SvelteKit provides an `enhanced-img` and other strategies to help serve optimized media. Also preload critical assets when appropriate and lazy-load non-critical images or iframes that are below the fold.
* **Benchmark and Profile:** Use Svelte dev tools and browser performance profilers to identify slow parts of your app. Svelte’s compiler makes updates efficient, so if you see slowness, it could be due to heavy computation in script or large lists. For large lists, consider using windowing (only render what’s visible) if the list is extremely long. Ensure any expensive computations are done outside the reactive/render cycle (e.g., use web workers for very CPU-intensive tasks so as not to block the UI).
* **Up-to-date Svelte:** Keep Svelte (and SvelteKit) versions updated. Newer versions often bring performance improvements. For example, Svelte 5 has performance enhancements over Svelte 3/4. Also, enabling production mode (via `NODE_ENV=production` or appropriate build command) will activate runtime optimizations and remove dev-only checks.

---

## Backend (Node.js with Fastify)

### Code Style and Formatting

* **JavaScript Style Guide:** Follow a consistent JavaScript style guide (e.g., Airbnb or StandardJS) for the backend code. This includes using 2-space or 4-space indentation (choose one convention), placing braces on the same line as control statements, and ending statements with semicolons (if your team prefers). Consistency improves readability.
* **ESLint and Prettier:** Use ESLint to enforce code style and catch errors – it’s the de-facto standard for Node.js linting. Include Node-specific ESLint plugins (like `eslint-plugin-node` and `eslint-plugin-import`) for additional rules. In tandem, run Prettier (or `eslint --fix`) to automatically format code. Prettier can handle indentation, quotes, commas, etc., leaving ESLint to focus on logical issues. This combination ensures a consistent format across the codebase with minimal manual effort.
* **Modern JavaScript Practices:** Write modern, clean JS. Use `const` for constants and `let` for mutable variables; avoid `var` entirely. Prefer arrow functions for anonymous callbacks for conciseness, but name your functions when they are substantial (to aid stack traces and readability). Use strict equality (`===`/`!==`) instead of loose equality to prevent type coercion bugs.
* **Organize Imports and Requires:** Require or import modules at the top of each file, not inside functions. This makes dependencies clear and avoids loading delays or repetition. Group built-in modules, third-party modules, and local modules separately for clarity. For example, list all `require()` statements at the top in logical groupings.
* **Coding Patterns:** Keep functions small and focused. A good practice is to keep each function’s length and responsibility limited (“Do One Thing”). Use early returns to avoid deep nesting. Handle errors explicitly rather than relying on silent failures. Also, avoid callback hell by using `async/await` for asynchronous code – it leads to more readable, linear code flow.

### Naming Conventions

* **Variables and Functions:** Use **lowerCamelCase** for variable and function names. Names should be descriptive but not verbose. For example, `let maxRetries = 5;`, `function calculateTotal() {…}`. Avoid single-letter names except in trivial loops. Booleans should often be prefixed with `is/has/should` for clarity (e.g., `isAuthorized`).
* **Constants:** Use **UPPER\_SNAKE\_CASE** for constants that are truly constant (e.g., configuration values, environment constants). For instance, `const MAX_CONNECTIONS = 100;`. This signals to other developers that the value should not change. Only use this style for values that are conceptually constants, not just any `const` variable.
* **Classes and Constructors:** Use **PascalCase** (UpperCamelCase) for class names and constructor functions. e.g., `class UserService { ... }` or `function DatabaseClient() { ... }` when used with `new`. This distinguishes them from regular functions. Class files can be named accordingly (e.g., file `UserService.js` exporting class `UserService`).
* **Filnames and Directories:** For files, either use kebab-case (e.g., `user-controller.js`) or lowerCamelCase consistently. Many Node projects use kebab-case for multi-word file names. Directories can be all lowercase. Choose a convention and stick to it across the project. For example, if using feature folders: `orders/OrderController.js`, `orders/order-service.js` (mixing case as needed but consistently). If a file exports a single class or factory, matching the class name (PascalCase file) is acceptable, otherwise prefer lowercase.
* **Database Entities:** If your Node code corresponds to database tables or collections, use naming consistent with your database conventions. For example, if your DB tables are singular (or plural), reflect that in naming your data access or model objects (e.g., a model class `User` corresponds to table `users`). Consistency between layers helps reduce confusion.

### Directory and File Organization

* **Feature-Based Structure:** Organize code by **components or features** rather than by technical layers, where it makes sense. A common approach is to group related routes, handlers, and logic in a feature folder. For example, have an `orders/` directory containing `orders.routes.js` (Fastify plugin defining routes), `orders.controller.js` (route handlers), `orders.service.js` (business logic), and perhaps `orders.test.js`. This way, all code for a given domain (orders) is co-located, making the project easier to navigate.
* **Layer Separation:** Within each feature/component, separate concerns into layers: e.g., an **entry-point (controller)** layer for request/response handling, a **service (domain)** layer for business logic, and a **data-access** layer for database interactions. This 3-tier layering keeps your Fastify route handlers lean – they should mostly validate input, call service methods, and send responses. The service layer contains core logic independent of HTTP, and the data-access (could be raw SQL queries or an ORM model) deals with persistence. Keeping these in separate modules improves testability and reusability.
* **Fastify Plugin Structure:** Take advantage of Fastify’s plugin system to organize routes. Each feature route can be defined as a plugin (for example, an `orders.routes.js` that calls `fastify.get('/orders', ...)` and is registered via `fastify.register(require('./orders.routes'))`). Using the `@fastify/autoload` plugin or manual registration, you can automatically load all route definitions from a routes folder. This avoids one huge server file and makes adding/removing features easier.
* **Common Utilities:** Place shared utilities (e.g., logger, authentication middleware, error handlers) in a `libs/` or `plugins/` directory outside the feature folders. For instance, have a `utils/logger.js` or a `plugins/jwtAuth.js`. Treat them as internal libraries – they can even have their own substructure or a package.json if using a monorepo style, but at minimum keep them distinct from feature code.
* **Configuration and Environment:** Store configuration (like a config module or JSON/YAML files) in a dedicated `config/` directory. For multiple environments, you might have `config/development.json`, `config/production.json` or use environment variables. Load configuration at startup (using a library like `dotenv` or a config library). This keeps config separate from code. Also have a dedicated folder for startup scripts or server initialization (e.g., `app.js` or `server.js` at the root that registers all plugins and starts Fastify).

### Documentation and Comments

* **Inline Comments:** Use comments to explain non-obvious code behavior, especially in complex algorithms or important business logic. A good rule is: if a piece of code might be confusing or critical, add a comment about what it’s doing or why. For example, “// Using a binary search here for efficiency, as the list is sorted” gives context that isn’t obvious from code alone.
* **Function Documentation:** For important functions (especially those exposed as part of a module’s interface), include a JSDoc comment describing the function’s purpose, parameters, return type, and thrown errors. This is helpful for future maintainers and can be used to generate documentation if needed. Example:

  ```js
  /**
   * Calculates the total price of an order.
   * @param {Order} order - The order object.
   * @returns {number} The total price.
   */
  function calculateOrderTotal(order) { ... }
  ```

  Such documentation helps ensure understanding of complex logic and serves as live documentation for the code.
* **API Documentation:** For a Fastify server, consider using tools or comments to document your API endpoints. You can use OpenAPI (Swagger) specifications to describe routes, either via annotations (e.g., using `fastify-swagger` and JSDoc comments on routes) or a separate YAML/JSON file. This provides a clear contract for what your API offers and can be served via a Swagger UI. Document each route’s purpose, input schema, and output schema (Fastify can integrate with this since it uses JSON schemas for validation).
* **Readme and Guides:** Maintain a high-level **README** for the backend project that outlines how the project is structured, how to run it, and any notable conventions (e.g., “We use JSON Schema for request validation, see schema definitions in each route file.”). Additionally, you might keep markdown docs for specific areas (e.g., `docs/authentication.md` explaining the auth flow). Keeping such documentation up-to-date is important; it onboards new developers quickly and records decisions.
* **Comment Style:** Keep comments clear and concise. Use **TODO** comments for known improvements or tasks (and track these in your issue tracker if possible). Avoid large blocks of commented-out code in the repository; remove unused code to keep the codebase clean (source control will remember it if needed). If you temporarily comment something out during debugging, ensure it’s removed or uncommented before commit.

### Recommended Linting and Formatting Tools

* **ESLint Configuration:** ESLint is essential for maintaining code quality in Node. Start with a popular base config like **Airbnb’s** or **StandardJS**, then adjust for your needs. Include Node-specific rules via plugins – for example, `eslint-plugin-node` (ensures no deprecated APIs, proper error handling for callbacks, etc.) and if using Jest or other test frameworks, include those plugins too. ESLint will catch common mistakes (undefined variables, unused variables, improper imports) and can enforce style conventions (like spacing, quotes). Many security issues can also be detected by ESLint (with plugins like `eslint-plugin-security`).
* **Prettier or StandardJS:** For automated formatting, use Prettier. Configure it to match your style (print width, semicolons, quotes, trailing commas, etc.) and add a Prettier check or auto-format on commit. This eliminates arguments about formatting. An alternative is using StandardJS which is an opinionated style+linter combination (no semicolons, etc.), but using it means adopting its conventions fully. Choose one formatting approach and apply it project-wide.
* **Git Hooks:** Utilize git hooks (with a tool like **Husky**) to run linters/formatters pre-commit or pre-push. For example, a pre-commit hook can run `eslint --fix` on staged files and `prettier --write` to auto-correct issues, then run tests. This prevents bad or poorly styled code from even entering commits.
* **Continuous Integration:** In CI, run an ESLint check (and possibly a formatting check). This acts as a safety net to ensure all code in pull requests adheres to standards. You can fail the build if lint errors are present, enforcing that developers fix issues before merging. This automated gate keeps the main branch clean.
* **Security Linters:** Consider adding **security linters** or scanners. For example, `eslint-plugin-security` to detect some common insecure coding patterns (like use of `eval()` or insecure regex). Additionally, use `npm audit` (or GitHub’s dependency graph) in CI to warn of vulnerable packages in your `package.json`. While not formatting-related, these tools integrated with your linting process help maintain overall code health.

### Testing Standards and Frameworks

* **Unit Testing:** Use a test framework like **Jest** (or **Mocha** with assertion libraries like Chai) to write unit tests for your backend logic. Every function or module that contains business logic should have corresponding tests. For example, service functions that calculate things, or utility modules, should be covered. Aim to isolate units in tests by mocking external dependencies (e.g., use test doubles for database calls or HTTP calls). This ensures that logic is correct in isolation and failures are easy to pinpoint.
* **Integration Testing:** Use integration tests to ensure different parts of the system work together. With Fastify, you can spin up the server in a test environment and use Fastify’s built-in HTTP injection to simulate requests **without actually binding to a port**. For example, `fastify.inject({ method: 'POST', url: '/login', payload: {...} })` can be used in tests to hit your routes in-memory and get a response. This is great for testing the full request pipeline (routing, validation, logic, DB calls with a test DB) without an external HTTP server. Ensure to seed/cleanup a test database or use transactions to isolate test data.
* **Test Structure:** Follow Arrange-Act-Assert (AAA) pattern in tests for clarity. Give tests descriptive names. For example, `"POST /api/orders returns 201 and saves to DB"` makes it clear what’s expected. Group related tests with `describe` blocks (e.g., group by route or by module being tested). Include edge cases (error paths, invalid inputs) as well as happy paths. According to Node best practices, at minimum ensure each API endpoint has at least one test covering it.
* **Test Environment:** Use a separate configuration for tests (like a `.env.test` or NODE\_ENV=test triggers a different config) so you don’t accidentally send requests to real services or databases. For database, you might use an in-memory DB (for SQLite) or spin up a Docker container for PostgreSQL in CI. Fastify tests are fast, especially if you avoid real network calls – prefer to stub out external integrations (e.g., if your service calls an external API, use Nock or similar to simulate those calls in tests).
* **Code Coverage:** Measure code coverage and strive to keep it high (e.g., 80%+). While 100% coverage is not a guarantee of no bugs, low coverage indicates untested parts of the code. Identify critical areas (authentication, payment processing, etc.) and ensure thorough tests there. Use coverage tools (Jest has built-in coverage, or Istanbul/NYC) to get reports. This also prevents accidental drop in coverage if integrated into CI (some teams set a coverage threshold in the test runner to fail if coverage drops below a certain percentage).

### Security Best Practices

* **Input Validation:** Never trust client input. Use JSON schema validation for routes in Fastify (Fastify allows defining a schema for query, params, and body, which it will validate automatically). This ensures that invalid data never even reaches your route handler. By validating types, formats (emails, UUIDs), and using allowed value lists, you prevent a large class of bugs and potential injections. Fastify’s schema feature is very fast (compiled schemas), so take advantage of it for every route.
* **Authentication and Authorization:** Use robust authentication (e.g., JWTs with the `@fastify/jwt` plugin or session cookies with `@fastify/secure-session`). Store passwords using strong hashing (bcrypt/scrypt) if your app manages credentials. Implement role-based access control (or similar) for sensitive routes – verify user permissions in handlers or via pre-handlers. Also, protect against brute-force attacks (e.g., implement rate limiting on auth endpoints using `@fastify/rate-limit` plugin).
* **Avoid SQL Injection:** Always use parameterized queries or an ORM for database access. Never concatenate user input into SQL strings. If using a library like node-postgres, use parameter placeholders (`$1, $2`, etc.). If using an ORM or query builder (like Knex or Prisma), it will handle injection for you. This is crucial to prevent attackers from injecting malicious SQL via inputs.
* **Secure Headers and HTTPS:** Use `@fastify/helmet` to automatically set secure HTTP headers (Content-Security-Policy, XSS-Protection, HSTS, etc.). These headers defend against a range of attacks (XSS, clickjacking, etc.). Always run your Fastify server behind HTTPS (either terminate SSL at a reverse proxy or use Fastify’s HTTPS options in production). For cookies (if any), set HttpOnly and Secure flags so they’re not accessible to client scripts and not sent over plain HTTP.
* **Error Handling:** Do not leak sensitive information in error messages. For example, if a database query fails, don’t send back the raw SQL or stack trace to the client. Catch errors and respond with generic messages or codes (while logging the detailed error on the server). Fastify has a global error handler – use it to format errors consistently (maybe using Boom or a similar library for HTTP-friendly errors). Ensure that unhandled promise rejections and exceptions are logged and the process exits or recovers gracefully (Fastify will log and handle many cases, but for safety, attach handlers for `unhandledRejection` and `uncaughtException` that log and exit or attempt graceful shutdown).
* **Least Privilege and Secrets:** Run the Node process with least privileges – it should not run as root. If using Docker, use a non-root user in the container. Keep secrets (API keys, DB passwords) out of source code – use environment variables or secret management. Consider using a config library that can validate the presence of required secrets on startup. Also, regularly update dependencies to pull in security fixes, and use `npm audit` or other scanners to identify vulnerabilities.

### Performance Best Practices

* **Non-Blocking Event Loop:** Keep the Node.js event loop free. Avoid long-running synchronous code or CPU-heavy computations on the main thread. If you have CPU-bound tasks (image processing, large data crunching), offload them to worker threads or external services, or use `setImmediate`/`process.nextTick` to break up large loops. The mantra is: **don’t block the event loop**. This ensures your Fastify server can continue handling other requests while one request is doing heavy work.
* **Asynchronous I/O and Streams:** Leverage Node’s async nature for I/O. Use streaming responses for large payloads – for example, if sending a large file or generating a big JSON, use Node streams or Fastify’s built-in stream handling to send chunks. This reduces memory pressure and time to first byte. Always prefer non-blocking methods (e.g., use `fs.promises` or async versions of functions instead of sync file reads).
* **Connection Handling:** Fastify is very fast out of the box, but to scale, run multiple instances (cluster or load-balanced processes) to utilize multiple CPU cores. You can use Node’s cluster module or a process manager like PM2 to fork workers (one per CPU). This ensures your app scales vertically. Fastify also supports HTTP/2 which can improve performance for clients via multiplexing – consider enabling it if appropriate.
* **Caching:** Implement caching at multiple levels. On the client side, set appropriate cache headers (Fastify/helmet can help, or manually set with reply headers) for static resources. Within your Node app, cache frequent computations or database results if feasible (e.g., an in-memory cache or using Redis). Fastify has a caching plugin `@fastify/caching` for HTTP caching support (ETag generation, etc.). Just be cautious to invalidate caches when underlying data changes.
* **Efficient Database Access:** For PostgreSQL specifically, use connection pooling (e.g., `pg` module’s pool or `@fastify/postgres` plugin which provides a shared pool) to reuse database connections. N+1 query problems can hurt performance – prefer joining data in queries or using batching rather than many sequential DB calls. Use appropriate indexes in the database to speed up queries (more on this in the PostgreSQL section). Also consider using an ORM or query builder that can cache compiled queries or optimize calls.
* **Monitoring and Profiling:** Employ monitoring (APM) tools to catch performance issues in production. For instance, use OpenTelemetry or built-in Fastify logging with response times to identify slow requests. Analyze these to find bottlenecks (maybe a particular route is slow due to an inefficient query). Node allows CPU profiling – in non-production or with minimal overhead, profile if you suspect a leak or slow function. Optimize the hotspots (for example, if JSON stringifying large objects is slow, consider streaming JSON or lighter serialization).
* **Memory Management:** Watch memory usage. Avoid loading huge data sets into memory at once – stream or paginate from the database. Use Node’s Heap snapshots (or tools like Clinic.js) to ensure no big memory leaks under load. Setting `NODE_ENV=production` enables certain Node optimizations and disables development overhead, so always set that in prod. Also, if running in containers, ensure you set resource limits and Node’s `--max_old_space_size` if needed to avoid container out-of-memory kills.

---

## Database (PostgreSQL)

### Code Style and Formatting (SQL)

* **SQL Formatting:** Write SQL statements in a consistent, readable format. Use uppercase for SQL keywords (SELECT, INSERT, WHERE, etc.) and lowercase for identifiers (table and column names). For example:

  ```sql
  SELECT id, first_name, last_name 
  FROM users 
  WHERE last_name = 'Smith';
  ```

  This uppercase keyword convention makes it easy to distinguish SQL syntax from schema names.
* **Whitespace and Indentation:** Format multi-line SQL queries with indentation that aligns clauses and makes logical blocks clear. For example, put each major clause (SELECT, FROM, WHERE, GROUP BY, ORDER BY) on a new line and indent continuation lines. Align conditions in the WHERE clause or set lists for readability:

  ```sql
  SELECT u.id, u.name, u.email
  FROM users AS u
  JOIN orders AS o 
    ON o.user_id = u.id
  WHERE u.status = 'active'
    AND o.created_at > CURRENT_DATE - INTERVAL '30 days';
  ```

  Here, `ON` and additional `AND` are indented to line up under the JOIN/WHERE above them, creating a “river” of whitespace that separates clauses. This vertical alignment greatly improves scan-ability of SQL.
* **Clause Order and Line Breaks:** Always write SQL clauses in the standard logical order (SELECT -> FROM -> JOIN -> WHERE -> GROUP BY -> HAVING -> ORDER BY -> LIMIT). Terminate each statement with a semicolon (`;`). Insert line breaks before `AND/OR` in WHERE clauses and after commas in column lists. This makes each condition or column stand alone on its own line, which is easier to diff and review.
* **Avoid Trailing Commas Issues:** In some SQL style guides, it’s recommended to put commas at the start of lines for SELECT lists to make adding new columns cleaner. Either approach (trailing comma or leading comma) is acceptable, but be consistent. For example, a trailing comma style:

  ```sql
  SELECT 
      id,
      first_name,
      last_name
  FROM users;
  ```

  Ensure the last column doesn’t have a comma. Consistency here prevents syntax errors.
* **Commenting SQL:** Include comments to explain non-trivial queries. Use `--` for single-line comments and `/* ... */` for block comments. For example, if a query implements a complex business rule, precede it with a brief comment:

  ```sql
  -- Calculate the monthly revenue for each product category
  SELECT category, SUM(amount) AS monthly_revenue
  FROM sales
  ...;
  ```

  Comments are crucial for SQL because a tightly optimized query might not be self-evident.

### Naming Conventions

* **General Naming:** Use **lowercase\_with\_underscores** (snake\_case) for all database identifiers – tables, columns, indexes, etc. This is a widely adopted convention in SQL for readability and portability. Avoid CamelCase or other casing; PostgreSQL by default folds unquoted identifiers to lowercase, so sticking to lowercase avoids confusion.
* **Table Names:** Choose clear, collective names for tables. Use plural nouns if it makes sense (e.g., `orders`, `customers`), or a collective term (`staff` instead of `employees`). The key is that it should represent a set of entities. Avoid prefixes like `tbl_` – they add no value. If your project has a convention (some prefer singular), it’s fine as long as it’s consistent. Make sure a table name isn’t the same as one of its columns (e.g., don’t have a table `order` with a column `order`).
* **Column Names:** Use singular for column names (since a column represents a single value within a row). Aim for meaningful names: `created_at` for timestamps, `first_name` instead of `fname`, etc. Include units or measures in the name if the data isn’t obvious (e.g., `price_cents` if storing prices as cents integer). Primary key columns often are just `id`, but if you have many tables joining, prefix them (e.g., `order_id` in an order\_items table). Many style guides advise against just `id` to avoid ambiguity, but if you consistently qualify with table aliases in joins, `id` is fine. The key is to be consistent.
* **Foreign Keys:** Name foreign key columns after the referenced table plus `_id`. For example, in `orders` table, use `customer_id` to reference `customers(id)`. This instantly tells you the relationship. If using an ORM, it often expects this pattern.
* **Indexes and Constraints:** Adopt a standard for naming constraints and indexes, or let PostgreSQL name them but be consistent in references. A common pattern: `<table>_<column>_idx` for indexes (e.g., `orders_created_at_idx` for an index on orders by created\_at), and `<table>_<column>_fkey` for foreign keys. PostgreSQL’s default names are similar, but explicitly naming can be clearer and avoids long auto-generated names. For primary keys, many use `<table>_pkey` (Postgres default). Uniform suffixes can help (e.g., `_pkey` for primary, `_uk` for unique key, `_chk` for check constraint, etc.).
* **Schema and Other Names:** If you use multiple schemas in PostgreSQL, name schemas in a way that reflects their purpose (e.g., `sales`, `admin`). Stick to lower\_snake\_case for schema names too. Avoid using the `public` schema for everything if your project grows – you can logically separate by schema (but note this adds complexity in managing search\_path). If schemas are used, include them in naming considerations (like don’t have two schemas with tables of the same name unless necessary to logically separate identical structures).
* **Avoid Reserved Words:** Make sure none of your table/column names is a SQL reserved keyword (like `user`, `order`, etc. are actually reserved in SQL standard). If you must use them, always quote them (but that leads to pain). It’s best to choose alternative names or add a qualifier (e.g., use `order_status` instead of just `order` which could conflict with the ORDER BY keyword). Use `pg_get_keywords()` in Postgres to see reserved words. Similarly, avoid spaces or special characters in names – stick to letters, numbers, underscores.

### Directory and File Organization (Database Code)

* **SQL Migration Files:** Organize your SQL migration scripts in a dedicated folder (commonly `migrations/`). Use a consistent naming scheme for migration files so their order is clear – for example, prefix with incremental timestamps or sequence numbers (e.g., `20230801_create_users.sql`, `20230801_add_index_on_orders.sql`) or an ordered number (`001_initial.sql`, `002_add_orders.sql`). Each migration file should ideally contain a single logical set of changes (e.g., create a table and related indices). Having descriptive names (e.g., `005-add-email-to-customers.sql`) helps identify their purpose at a glance.
* **Migration Management:** If using a migration tool (like Flyway, Liquibase, or Node libraries like Knex or TypeORM migrations), follow its conventions for file structure. Typically, it will enforce a versioning or timestamp. Keep migration files immutable once run in production – never edit a past migration; instead, create a new one to modify schema (this ensures consistency across environments). Use source control to track these files, and consider adopting a policy of one migration per PR if possible to simplify rollback if needed.
* **SQL Scripts and Seeds:** For seed data or one-off admin scripts, keep them in a `sql/` or `scripts/` directory. Make sure they are well documented if they are meant to be run manually. Do not mix these with migrations – migrations should be strictly schema (and sometimes reference/master data) changes that are applied automatically. If using seed files (for dev/test environments), organize them similarly (e.g., `seeds/init_data.sql`).
* **Database Configuration:** Store database configuration and connection info separate from queries. For instance, have a `.env` for connection strings, or a config JSON (which your Node app or migration tool reads). Keep this out of your SQL code files. This separation makes it easier to manage environments (dev/staging/prod each have different credentials, but the SQL code is the same).
* **Version Control and Review:** All schema changes (SQL files) should be checked into version control and ideally reviewed. Treat database code like application code. Code reviews for migrations can catch mistakes like missing indexes or naming inconsistencies early. It’s also helpful to include in the repository a current schema diagram or definition (some projects include an ERD or use a `schema.sql` dump that is kept updated).
* **Backup and Docs:** It’s not exactly file organization, but maintain documentation of your database schema. This could be as simple as a `SCHEMA.md` that lists each table and its purpose, or a link to an ERD. It helps new developers or ops engineers understand the DB. If your project is large, consider generating this documentation from the schema (tools can reverse-engineer or you can maintain it manually).

### Documentation and Comments (SQL & Schema)

* **Schema Documentation:** Leverage PostgreSQL’s COMMENT feature to document schema objects in the database itself. For example, after creating a table or column, you can do:

  ```sql
  COMMENT ON TABLE users IS 'Stores user account information';
  COMMENT ON COLUMN users.email IS 'Email address, used for login and notifications';
  ```

  These comments can later be retrieved from system catalogs and are incredibly useful for developers and DBAs exploring the schema. They serve as in-place documentation for anyone using psql or schema inspection tools.
* **ERDs and Diagrams:** If possible, maintain an entity-relationship diagram of the database. This can be auto-generated or manually drawn. Place it in the project docs (even if it’s just a PNG/PDF checked in). Visualizing the schema helps ensure the relationships are clear. Update it whenever significant schema changes occur.
* **Inline Query Comments:** As mentioned, within SQL scripts or complex query definitions in application code, use comments to explain logic. For reporting or analytical queries with many joins and conditions, a short comment for each major section helps readers understand the intent. For example:

  ```sql
  -- Get users with their last order date in the past month
  SELECT u.id, u.name, MAX(o.created_at) as last_order_date
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  GROUP BY u.id
  HAVING MAX(o.created_at) >= (CURRENT_DATE - INTERVAL '30 days');
  ```

  A comment was added to clarify the goal, which may not be obvious just by reading the SQL.
* **Migrations README:** In your migrations folder, consider adding a README or guidelines file explaining how to add a new migration, the format to use, and how to run migrations. This is especially useful for onboarding or if you use manual SQL files without a framework. Document any custom conventions (for instance, “we wrap DDL in transactions” or “we use `IF NOT EXISTS` for creating tables to allow re-running scripts”).
* **Keep Comments Updated:** If schema changes render a comment incorrect, update the comment. For example, if a column’s meaning changes or a workaround in a query is removed in favor of a different approach, adjust or remove the stale comment. An outdated comment can be more misleading than none at all.

### Recommended Linting and Formatting Tools (SQL)

* **SQL Linters:** Use a SQL linter/formatter to keep SQL style consistent. Tools like **SQLFluff** are popular – SQLFluff can lint SQL against a configurable style guide (and it supports PostgreSQL dialect). It can catch syntax issues and enforce rules like capitalization, comma placement, etc. Incorporate it in your CI pipeline if possible (e.g., have it parse all `.sql` files or even SQL strings in your code). This will ensure, for instance, that keywords are uppercase, or that you don’t accidentally miss an `AS` in aliasing if your style guide requires it.
* **SQL Formatting:** For formatting, **pgFormatter** or **SQLFluff** can also auto-format queries. Some IDEs (DataGrip, VSCode with extensions) can format SQL files on save. Decide on a formatting convention and use these tools to apply it. For example, pgFormatter can enforce indentation and line breaks. Having an automated formatter for SQL is as useful as Prettier for code – it avoids debates and makes SQL diffs cleaner.
* **Integration with Editors:** Install SQL language support in your editors. This often provides basic linting. VSCode has the `SQLTools` extension which can format SQL and integrate with connections for running queries. Enabling editor formatting can help developers write well-formed SQL from the start.
* **Database Constraints Checks:** While not a traditional “linter,” consider tools that review your schema for best practices. For example, **Bytebase** or **Liquibase** have rule-based checks (like warning if a table doesn’t have a primary key, or if an index is missing on a foreign key column). Such checks can be part of a review process or CI step to maintain quality (Bytebase’s SQL review guide enumerates such rules, e.g., ensuring every online query has an index).
* **Continuous Integration:** If your project executes raw SQL (like migrations) as part of CI tests, that itself is a lint – a migration that fails to apply is caught early. Incorporate a step in CI to run migrations on a fresh database (e.g., start a Postgres service in GitHub Actions or use a local Docker in your pipeline) and verify they all apply. This prevents broken SQL from reaching production. In addition, if you have long or complex stored procedures or functions, consider adding unit tests for those using a framework like pgTAP (which allows writing tests in SQL for database functions), although that might be overkill for simpler projects.

### Testing Standards and Frameworks (Database)

* **Migration Testing:** Before running migrations on production, test them in a staging environment. A best practice is to have an automated test that spins up a database, applies all migrations in order, and verifies the final schema matches expectations. If using an ORM with migrations, you can also generate the schema from models and compare. Ensure that rollback mechanisms (if any) are tested too – practice rolling back a migration in a safe environment so you know the procedure.
* **Stored Procedures/Functions:** If you use PostgreSQL functions or procedures (PL/pgSQL or SQL functions), consider testing them with a framework like **pgTAP**. pgTAP allows you to write assertions in SQL against function outputs or triggers. For instance, you can assert that `select add_numbers(2,2)` equals 4. These tests can be part of your migration suite or run separately. They help catch logic errors at the database level.
* **Data Integrity Tests:** Write tests (in application code or SQL) that ensure your database constraints and logic are working. For example, after running migrations in a test, you might insert sample data that violates a foreign key or check constraint to confirm it fails (and thus the constraint is effective). Similarly, test cascades or triggers if you rely on them (e.g., deleting a user should cascade delete their orders – test that this actually happens in the DB).
* **Load Testing Queries:** For performance-critical queries (like those used in heavy reports or key transactions), do rudimentary load testing. You can use EXPLAIN plans to ensure they use indexes properly and perhaps write a script to run the query multiple times with sample data to measure timing. This isn’t exactly a “test” in pass/fail terms, but part of ensuring your SQL will perform under load.
* **Backup/Recovery Drills:** Again, slightly orthogonal to coding standards, but in terms of database reliability: practice restoring backups or using point-in-time recovery if enabled. While not a test of code, it’s a test of your infrastructure and processes – ensuring that if a migration goes wrong or data is corrupted, you can revert. In development, you might simulate a backup restore of baseline data before running a complex migration to simulate the production scenario.
* **Use Transactional Migrations:** When writing manual SQL migrations, wrap them in transactions (PostgreSQL supports transactional DDL for many operations). That way, if part of the migration fails, it will rollback entirely, preventing half-applied schema. Some migration tools do this automatically. Test this behavior by forcing an error in a migration on a test DB and confirming it rolls back. This ensures your migrations won’t leave the DB in an inconsistent state if something fails halfway.

### Security Best Practices

* **Least Privilege:** Follow the principle of least privilege for database access. The user account used by your application (e.g., the PostgreSQL user in your connection string) should have only the necessary privileges on the needed schemas/tables – typically SELECT/INSERT/UPDATE/DELETE on the application’s tables, and not superuser or createdb rights. Don’t connect as the `postgres` superuser from your app. Create a role for your app and grant it only what it needs. This limits damage if the app is compromised.
* **Secure Password Storage:** If your database contains user passwords or other secrets, ensure they are stored hashed (and salted) using strong algorithms (bcrypt, Argon2, etc.), which is usually handled in the application layer. The database should never store raw sensitive personal data if it can be avoided (credit card numbers, plaintext passwords, etc.). If you must store sensitive data, consider using PostgreSQL’s extension such as PGCrypto for encryption, or perform encryption at the application side.
* **SQL Injection Defense:** Although parameterization is primarily an application-level concern, reinforce it: never use string concatenation to build SQL inside functions or database procedures either. In PL/pgSQL, use quote\_literal/quote\_ident or format() with %I/%L placeholders if dynamic SQL is needed, to properly escape identifiers and literals.
* **Row-Level Security:** If you have multi-tenant data or need to ensure certain users only see certain rows, consider using PostgreSQL’s Row-Level Security (RLS) features. This can enforce at the database level that, for example, a tenant cannot access another tenant’s rows, even if a faulty query is executed. Use with caution and thorough understanding, but it’s a powerful security feature of Postgres.
* **Audit and Logging:** Enable and configure PostgreSQL logging to record statements or at least unsuccessful login attempts. Regularly review these for suspicious activity. If appropriate, use extensions or tools to audit data changes (e.g., who changed what). In code, ensure all changes go through audited pathways (or triggers capturing changes).
* **Backup Encryption and Access:** Ensure backups of PostgreSQL are stored securely (encrypted at rest) and access to them is limited. A data breach can just as easily happen via a stolen backup. Also, keep the database server itself secure: use a strong password for the `postgres` user, or disable password auth in favor of peer/internal for local and cert-based or IAM-based auth for external, if applicable. In `pg_hba.conf`, avoid “trust” authentication in production, and limit `listen_addresses` to necessary interfaces (e.g., localhost or specific internal IPs, not `0.0.0.0` unless required).
* **Prevent Data Leaks in Dev:** Scrub or anonymize production data when using it in lower environments for testing. This is a process aspect of security – developers often need realistic data, but ensure any personal or sensitive info is masked if a production clone is used in dev. Also, do not commit any actual data dumps to source control.

### Performance Best Practices

* **Indexing Strategy:** Create indexes to speed up frequent queries. Identify columns used in JOINs, WHERE filters, and ORDER BY clauses, and ensure appropriate B-tree indexes exist. Use multi-column indexes if queries often filter by multiple columns together. However, don’t over-index: each index has a cost on insert/update. Monitor slow queries (enable `log_min_duration_statement` in Postgres to catch slow queries) and add indexes accordingly. Also consider indexes on foreign key columns (Postgres doesn’t add those automatically, unlike some databases).
* **Avoid Full Table Scans:** Aim to design queries and indexes such that full table scans on large tables are not needed in OLTP use cases. If you see sequential scans in `EXPLAIN` on big tables where not intended, that’s a flag. Either adjust the query or add an index. Use `EXPLAIN ANALYZE` to get actual runtimes and verify that indexes are being used as expected. The Bytebase guide explicitly notes that all “online” (production) queries should be backed by indexes so that table scans are minimized.
* **Query Optimization:** Prefer set-based operations to row-by-row processing. For example, a single `UPDATE` with a set-based condition is usually better than updating rows in a loop from the application. Utilize SQL features like window functions for efficient data analysis on the server side rather than pulling large datasets into the app to process.
* **Limit Data Transfer:** Select only the columns you need – avoid `SELECT *` in production queries. This reduces network I/O and memory consumption. Similarly, fetch only necessary rows (use LIMIT or pagination for large result sets). The database is often capable of filtering and aggregating more efficiently than the application, so push filters/aggregations to the SQL query (but do so with proper indexes).
* **Connection Pooling:** Use a connection pooler like **PgBouncer** for handling a large number of connections efficiently. In a Node environment, the `pg` library pools by default, but if you have many app instances, a PgBouncer in transaction pooling mode can prevent overloading Postgres with connections. Ensure your app’s pool size is tuned (not too high to exhaust Postgres resources, but enough to utilize concurrency). Monitor connection usage – idle connections also consume memory.
* **Partitioning and Archiving:** For very large tables (tens of millions of rows and up), consider partitioning strategies (PostgreSQL’s declarative partitioning) to improve query performance and maintenance. Partition by date for time-series data, for example, so that old partitions can be detached or indexed differently. Archival: move out or delete data that is no longer needed in the main tables (e.g., soft-delete or archive old records to another table) to keep working set smaller.
* **Vacuum and Analyze:** Make sure autovacuum is tuned appropriately so it keeps up with update/delete activity. Regular `ANALYZE` runs (which autovacuum does) update statistics – stale stats can lead to poor query plans. If you bulk load a lot of data, consider manually running `ANALYZE` after. Monitoring auto-vacuum is part of performance best practices; a bloated table or index can slow things down.
* **Hardware and Config:** Utilize enough RAM so that most frequent indexes and data fit in memory (shared\_buffers, effective\_cache\_size tuned accordingly). If you anticipate heavy read load, ensure read replicas are in place and direct read-only queries to them (and Fastify app knows which queries can go to replica). For write-heavy scenarios, consider batching writes or using asynchronous job queues to smooth peaks.
* **Benchmarking:** Before deploying major schema changes or query changes, if possible, benchmark them. For instance, if you add a new index, measure write impact vs. read improvement. If you refactor a query, compare its performance on a copy of production data. PostgreSQL’s `EXPLAIN` along with tools like pgBadger can help identify slow queries over time. Regularly review those to continuously refine performance.
