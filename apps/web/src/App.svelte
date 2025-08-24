<script>
  import { onMount } from 'svelte';
  
  // Import route components
  import PipelinesPage from './routes/+page.svelte';
  import DatasetsPage from './routes/datasets/+page.svelte';
  import NodesPage from './routes/nodes/+page.svelte';
  import PipelineEditor from './routes/pipeline/[id]/+page.svelte';
  
  // Simple router state
  let currentRoute = 'pipelines';
  let routeParams = {};
  
  // Route to component mapping
  const routes = {
    pipelines: PipelinesPage,
    datasets: DatasetsPage,
    nodes: NodesPage,
    'pipeline-editor': PipelineEditor
  };
  
  // Handle navigation
  function navigate(route, params = {}) {
    currentRoute = route;
    routeParams = params;
    
    // Generate URL
    let url = '/';
    if (route === 'pipelines') {
      url = '/';
    } else if (route === 'pipeline-editor') {
      url = `/pipeline/${params.id}`;
    } else {
      url = `/${route}`;
    }
    
    // Update URL without reloading
    history.pushState({}, '', url);
  }
  
  // Parse URL and determine route
  function parseRoute(path) {
    if (path === '/' || path === '') {
      return { route: 'pipelines', params: {} };
    }
    
    // Handle /pipeline/[id] route
    const pipelineMatch = path.match(/^\/pipeline\/([^/]+)$/);
    if (pipelineMatch) {
      return { 
        route: 'pipeline-editor', 
        params: { id: pipelineMatch[1] }
      };
    }
    
    // Handle other simple routes
    const route = path.slice(1);
    if (routes[route]) {
      return { route, params: {} };
    }
    
    // Default to pipelines
    return { route: 'pipelines', params: {} };
  }
  
  // Update route based on URL
  function updateRouteFromUrl() {
    const path = window.location.pathname;
    const { route, params } = parseRoute(path);
    currentRoute = route;
    routeParams = params;
  }
  
  // Handle browser back/forward
  onMount(() => {
    // Set initial route based on URL
    updateRouteFromUrl();
    
    // Listen for browser navigation
    window.addEventListener('popstate', updateRouteFromUrl);
    
    // Make navigate function available globally
    window.navigate = navigate;
  });
  
  $: CurrentComponent = routes[currentRoute] || PipelinesPage;
</script>

<div class="min-h-screen bg-base-200">
  <!-- Navigation -->
  <div class="navbar bg-base-100 shadow-lg">
    <div class="navbar-start">
      <a class="btn btn-ghost normal-case text-xl font-bold" on:click={() => navigate('pipelines')}>
        EdgeQL
      </a>
    </div>
    
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal px-1">
        <li>
          <a 
            class="btn btn-ghost" 
            class:btn-active={currentRoute === 'pipelines'}
            on:click={() => navigate('pipelines')}
          >
            Pipelines
          </a>
        </li>
        <li>
          <a 
            class="btn btn-ghost"
            class:btn-active={currentRoute === 'datasets'}
            on:click={() => navigate('datasets')}
          >
            Datasets
          </a>
        </li>
        <li>
          <a 
            class="btn btn-ghost"
            class:btn-active={currentRoute === 'nodes'}
            on:click={() => navigate('nodes')}
          >
            Nodes
          </a>
        </li>
      </ul>
    </div>
    
    <div class="navbar-end">
      <div class="badge badge-success badge-sm">API Connected</div>
    </div>
  </div>

  <!-- Main content -->
  <main class="container mx-auto p-6">
    <svelte:component this={CurrentComponent} {...routeParams} />
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>