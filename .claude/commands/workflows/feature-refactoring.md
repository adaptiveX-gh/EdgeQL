Refactor an existing feature using specialized agents with explicit Task tool invocations:

[Extended thinking: This workflow systematically refactors existing features through analysis, planning, incremental implementation, and validation. Each agent builds upon insights from previous agents to ensure cohesive modernization.]

Use the Task tool to delegate to specialized agents in sequence:

## Phase 1: Analysis and Planning

1. **Current Implementation Analysis**
   - Use Task tool with subagent_type="code-reviewer"
   - Prompt: "Analyze the current implementation of: $ARGUMENTS. Identify code quality issues, technical debt, performance bottlenecks, and architectural concerns. Provide detailed assessment of what needs refactoring."
   - Document findings for planning phase

2. **Refactoring Strategy Design**
   - Use Task tool with subagent_type="architect-reviewer"
   - Prompt: "Based on the code analysis: [include findings from step 1], design a comprehensive refactoring strategy for: $ARGUMENTS. Include migration approach, risk assessment, and rollback plan."
   - Define clear refactoring objectives and success criteria

## Phase 2: Impact Assessment

3. **Dependency and Integration Analysis**
   - Use Task tool with subagent_type="backend-architect"
   - Prompt: "Analyze dependencies and integration points for refactoring: $ARGUMENTS. Map out affected systems, APIs, and data flows. Include backward compatibility considerations and breaking change assessment."
   - Identify all systems that may be impacted

4. **Test Coverage Assessment**
   - Use Task tool with subagent_type="test-automator"
   - Prompt: "Evaluate existing test coverage for: $ARGUMENTS. Identify testing gaps and create comprehensive test strategy for the refactoring process. Include regression testing approach."
   - Ensure safety net before changes begin

## Phase 3: Incremental Implementation

5. **Core Refactoring Implementation**
   - Use Task tool with subagent_type="legacy-modernizer"
   - Prompt: "Implement the core refactoring for: $ARGUMENTS using the strategy from step 2. Apply modern patterns, improve code organization, and enhance maintainability. Work incrementally to minimize risk."
   - Execute primary code improvements

6. **Performance Optimization**
   - Use Task tool with subagent_type="performance-engineer"
   - Prompt: "Optimize performance during refactoring of: $ARGUMENTS. Address bottlenecks identified in step 1 and implement performance improvements while maintaining functionality."
   - Enhance system performance through refactoring

7. **Security Hardening**
   - Use Task tool with subagent_type="security-auditor"
   - Prompt: "Review and improve security aspects during refactoring of: $ARGUMENTS. Address security vulnerabilities, implement best practices, and ensure compliance with security standards."
   - Strengthen security posture

## Phase 4: Validation and Integration

8. **Comprehensive Testing**
   - Use Task tool with subagent_type="test-automator"
   - Prompt: "Execute comprehensive testing for refactored: $ARGUMENTS. Run regression tests, integration tests, and performance tests. Validate that all functionality works as expected."
   - Verify refactoring success

9. **Documentation Updates**
   - Use Task tool with subagent_type="api-documenter"
   - Prompt: "Update documentation for refactored: $ARGUMENTS. Include API changes, architectural updates, deployment notes, and migration guides. Ensure documentation reflects current state."
   - Keep documentation current

10. **Deployment Readiness**
    - Use Task tool with subagent_type="deployment-engineer"
    - Prompt: "Prepare deployment strategy for refactored: $ARGUMENTS. Include rollout plan, monitoring, rollback procedures, and production validation steps."
    - Ensure safe production deployment

## Multi-Domain Coordination

For complex refactoring spanning multiple domains:
1. Coordinate changes across frontend, backend, and database layers
2. Ensure API contracts remain stable or provide migration paths
3. Validate integration between refactored components
4. Monitor system behavior throughout the refactoring process

## Risk Mitigation Strategies

- **Feature Flags**: Use feature toggles for gradual rollout
- **Parallel Implementation**: Run old and new implementations side-by-side
- **Database Migrations**: Plan schema changes carefully with rollback options
- **Monitoring**: Enhanced observability during transition period
- **Staged Rollout**: Deploy incrementally across environments

Aggregate results from all agents and present a unified refactoring implementation with clear before/after comparisons and migration guidance.

Feature to refactor: $ARGUMENTS