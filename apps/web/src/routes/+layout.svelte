<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  
  let sidebarOpen = false;
  
  const toggleSidebar = () => {
    sidebarOpen = !sidebarOpen;
  };
</script>

<div class="drawer lg:drawer-open">
  <input id="drawer-toggle" type="checkbox" class="drawer-toggle" bind:checked={sidebarOpen} />
  
  <div class="drawer-content flex flex-col">
    <!-- Navbar -->
    <div class="navbar bg-base-100 shadow-lg lg:hidden">
      <div class="flex-none">
        <label for="drawer-toggle" class="btn btn-square btn-ghost">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </label>
      </div>
      <div class="flex-1">
        <a class="btn btn-ghost text-xl font-bold">EdgeQL ML</a>
      </div>
    </div>
    
    <!-- Page content -->
    <main class="flex-1 p-6">
      <slot />
    </main>
  </div>
  
  <!-- Sidebar -->
  <div class="drawer-side">
    <label for="drawer-toggle" class="drawer-overlay"></label>
    <aside class="w-80 min-h-full bg-base-200">
      <div class="p-4">
        <h1 class="text-2xl font-bold text-primary">EdgeQL ML</h1>
        <p class="text-sm text-base-content/70">Strategy Backtesting</p>
      </div>
      
      <ul class="menu p-4 space-y-2">
        <li>
          <a href="/" class:active={$page.url.pathname === '/'} class="flex items-center gap-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
            </svg>
            Pipelines
          </a>
        </li>
        <li>
          <a href="/nodes" class:active={$page.url.pathname === '/nodes'} class="flex items-center gap-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            Node Library
          </a>
        </li>
        <li>
          <a href="/runs" class:active={$page.url.pathname === '/runs'} class="flex items-center gap-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            Run History
          </a>
        </li>
        <li>
          <a href="/datasets" class:active={$page.url.pathname === '/datasets'} class="flex items-center gap-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
            </svg>
            Datasets
          </a>
        </li>
      </ul>
      
      <div class="p-4 mt-auto">
        <div class="text-xs text-base-content/50">
          v0.1.0 - MVP
        </div>
      </div>
    </aside>
  </div>
</div>

<style>
  .active {
    @apply bg-primary text-primary-content;
  }
</style>