import { ShieldX, TriangleAlert } from 'lucide-solid';
import { Match, Show, Switch, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { getCurrentUser } from './api';
import MetaTabs from './components/MetaTabs';
import TopNavigation from './components/TopNavigation';
import UserTabs from './components/UserTabs';
import DatasourceCreatePage from './pages/DatasourceCreatePage';
import DatasourcePage from './pages/DatasourcePage';
import DatasourceUpdatePage from './pages/DatasourceUpdatePage';
import EntityWorkspacePage from './pages/EntityWorkspacePage';
import GrantManagementPage from './pages/GrantManagementPage';
import LoginPage from './pages/LoginPage';
import TableMetadataCreatePage from './pages/TableMetadataCreatePage';
import TableMetadataUpdatePage from './pages/TableMetadataUpdatePage';
import TableWorkspacePage from './pages/TableWorkspacePage';
import UserCreatePage from './pages/UserCreatePage';
import UserPage from './pages/UserPage';
import UserUpdatePage from './pages/UserUpdatePage';
import {
  canAdminUsers,
  canCreateDatasource,
  clearSession,
  hasSession,
  isSuperAdmin,
} from './session';
import type { CurrentUser, RouteState } from './types';

function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  return {
    pathname: window.location.pathname,
    redirect: params.get('redirect'),
    datasource: params.get('datasource'),
    table: params.get('table'),
    resource_type: params.get('resource_type'),
    resource_id: params.get('resource_id'),
    user: params.get('user'),
    role: params.get('role'),
  };
}

interface WorkspaceProps {
  user: CurrentUser;
  route: RouteState;
  navigate: (url: string, replace?: boolean) => void;
  onLogout: () => void;
}

function Workspace(props: WorkspaceProps) {
  const noOp = () => undefined;

  createEffect(() => {
    if (props.route.pathname === '/') props.navigate('/meta/datasource', true);
    if (props.route.pathname === '/meta') {
      props.navigate('/meta/datasource', true);
    }
  });

  return (
    <div class="app-layout top-layout">
      <TopNavigation
        user={props.user}
        route={props.route}
        navigate={props.navigate}
        onLogout={props.onLogout}
      />
      <div class="top-main-area">
        <Show when={props.route.pathname.startsWith('/meta')}>
          <MetaTabs pathname={props.route.pathname} navigate={props.navigate} />
        </Show>
        <Show when={(props.route.pathname.startsWith('/user') || props.route.pathname.startsWith('/grant')) && canAdminUsers(props.user)}>
          <UserTabs pathname={props.route.pathname} navigate={props.navigate} />
        </Show>
        <Switch>
          <Match when={props.route.pathname === '/meta/datasource/create' && canCreateDatasource(props.user)}>
            <DatasourceCreatePage navigate={props.navigate} onCreated={noOp} />
          </Match>
          <Match when={props.route.pathname === '/meta/datasource/update' && props.route.datasource}>
            <DatasourceUpdatePage id={props.route.datasource} navigate={props.navigate} onUpdated={noOp} />
          </Match>
          <Match when={props.route.pathname === '/meta/datasource'}>
            <DatasourcePage canCreate={canCreateDatasource(props.user)} navigate={props.navigate} onChanged={noOp} />
          </Match>
          <Match when={props.route.pathname === '/meta/table/create' && props.route.datasource}>
            <TableMetadataCreatePage datasourceId={props.route.datasource} navigate={props.navigate} onCreated={noOp} />
          </Match>
          <Match when={props.route.pathname === '/meta/table/update' && props.route.datasource && props.route.table}>
            <TableMetadataUpdatePage tableId={props.route.table} datasourceId={props.route.datasource} navigate={props.navigate} onUpdated={noOp} />
          </Match>
          <Match when={props.route.pathname === '/meta/table'}>
            <TableWorkspacePage datasource={props.route.datasource} navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/entity' || props.route.pathname === '/entity/create'}>
            <EntityWorkspacePage route={props.route} navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/user/create' && canAdminUsers(props.user)}>
            <UserCreatePage navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/user/update' && canAdminUsers(props.user)}>
            <UserUpdatePage id={props.route.user} navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/user' && canAdminUsers(props.user)}>
            <UserPage
              currentUserId={props.user.id}
              canGrantAllDatasources={props.user.is_datasource_admin}
              navigate={props.navigate}
            />
          </Match>
          <Match when={props.route.pathname === '/grant' && canAdminUsers(props.user)}>
            <GrantManagementPage
              userIds={props.route.user}
              roles={props.route.role}
              resourceType={props.route.resource_type}
              resourceIds={props.route.resource_id}
              canManageAdministrativeRoles={isSuperAdmin(props.user)}
              canGrantAllDatasources={props.user.is_datasource_admin}
              navigate={props.navigate}
            />
          </Match>
          <Match when={(props.route.pathname.startsWith('/user') || props.route.pathname.startsWith('/grant')) && !canAdminUsers(props.user)}>
            <div class="app-state app-error"><ShieldX size={22} />没有访问该页面的权限</div>
          </Match>
          <Match when>
            <div class="app-state app-error"><TriangleAlert size={22} />页面不存在</div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = createSignal(readRoute());
  const [user, setUser] = createSignal<CurrentUser | null>(null);
  const [booting, setBooting] = createSignal(true);

  function navigate(url: string, replace = false) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
    setRoute(readRoute());
  }

  function safeRedirect(value: string | null): string | null {
    if (!value?.startsWith('/') || value.startsWith('//')) return null;
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname === '/login') return null;
    return `${target.pathname}${target.search}`;
  }

  function redirectToLogin() {
    if (route().pathname === '/login') return;
    const returnTo = `${window.location.pathname}${window.location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(returnTo)}`, true);
  }

  async function loadUser() {
    const current = await getCurrentUser();
    setUser(current);
    if (route().pathname === '/login') {
      navigate(safeRedirect(route().redirect) ?? '/meta/datasource', true);
    }
  }

  function logout() {
    clearSession();
    setUser(null);
    navigate('/login', true);
  }

  const onPopState = () => setRoute(readRoute());
  const onAuthExpired = () => {
    setUser(null);
    redirectToLogin();
  };

  onMount(async () => {
    window.addEventListener('popstate', onPopState);
    window.addEventListener('auth-expired', onAuthExpired);
    try {
      if (hasSession()) await loadUser();
      else redirectToLogin();
    } catch {
      clearSession();
      setUser(null);
      redirectToLogin();
    } finally {
      setBooting(false);
    }
  });
  onCleanup(() => {
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('auth-expired', onAuthExpired);
  });

  createEffect(() => {
    if (!booting() && !user() && route().pathname !== '/login') redirectToLogin();
  });

  return (
    <Show when={!booting()} fallback={<div class="app-state">正在验证登录状态...</div>}>
      <Show when={user()} keyed fallback={<LoginPage onAuthenticated={loadUser} />}>
        {(currentUser) => (
          <Workspace user={currentUser} route={route()} navigate={navigate} onLogout={logout} />
        )}
      </Show>
    </Show>
  );
}
