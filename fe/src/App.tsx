import { LogOut, RefreshCw, ShieldX, TriangleAlert } from 'lucide-solid';
import { Match, Show, Switch, batch, createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { getCurrentUser } from './api/auth';
import MetaTabs from './components/MetaTabs';
import TopNavigation from './components/TopNavigation';
import UserTabs from './components/UserTabs';
import DatasourceCreatePage from './pages/DatasourceCreatePage';
import DatasourcePage from './pages/DatasourcePage';
import DatasourceUpdatePage from './pages/DatasourceUpdatePage';
import EntityWorkspacePage from './pages/EntityWorkspacePage';
import GrantManagementPage from './pages/GrantManagementPage';
import RoleGrantByResourcePage from './pages/role/RoleGrantByResourcePage';
import RoleGrantByUserPage from './pages/role/RoleGrantByUserPage';
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
import { readRoute } from './routing';
import type { RouteState } from './types/route';
import type { CurrentUser } from './types/user';

interface WorkspaceProps {
  user: CurrentUser;
  route: RouteState;
  navigate: (url: string, replace?: boolean) => void;
  onLogout: () => void;
}

function Workspace(props: WorkspaceProps) {
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
          <Match when={props.route.error}>
            <div class="app-state app-error"><TriangleAlert size={22} />{props.route.error}</div>
          </Match>
          <Match when={props.route.pathname === '/meta/datasource/create' && canCreateDatasource(props.user)}>
            <DatasourceCreatePage navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/meta/datasource/update' && props.route.datasource}>
            <Show when={props.route.datasource} keyed>
              {(datasource) => <DatasourceUpdatePage name={datasource} navigate={props.navigate} />}
            </Show>
          </Match>
          <Match when={props.route.pathname === '/meta/datasource'}>
            <DatasourcePage canCreate={canCreateDatasource(props.user)} canDelete={isSuperAdmin(props.user)} navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/meta/table/create' && props.route.datasource}>
            <Show when={props.route.datasource} keyed>
              {(datasource) => <TableMetadataCreatePage datasource={datasource} navigate={props.navigate} />}
            </Show>
          </Match>
          <Match when={props.route.pathname === '/meta/table/update' && props.route.datasource && props.route.table}>
            <Show when={props.route.table} keyed>
              {(tableId) => <TableMetadataUpdatePage tableId={tableId} datasource={props.route.datasource} navigate={props.navigate} />}
            </Show>
          </Match>
          <Match when={props.route.pathname === '/meta/table'}>
            <TableWorkspacePage datasource={props.route.datasource} canGrant={isSuperAdmin(props.user)} navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/entity' || props.route.pathname === '/entity/create'}>
            <EntityWorkspacePage route={props.route} navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/user/create' && canAdminUsers(props.user)}>
            <UserCreatePage navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/user/update' && canAdminUsers(props.user)}>
            <Show when={props.route.user} keyed fallback={<UserUpdatePage id={null} navigate={props.navigate} />}>
              {(userId) => <UserUpdatePage id={userId} navigate={props.navigate} />}
            </Show>
          </Match>
          <Match when={props.route.pathname === '/user' && canAdminUsers(props.user)}>
            <UserPage
              currentUserId={props.user.id}
              navigate={props.navigate}
            />
          </Match>
          <Match when={props.route.pathname === '/grant' && canAdminUsers(props.user)}>
            <GrantManagementPage navigate={props.navigate} />
          </Match>
          <Match when={props.route.pathname === '/grant/user' && canAdminUsers(props.user) ? props.route.grant_user : null}>
            {(selection) => <RoleGrantByUserPage selection={selection()} navigate={props.navigate} />}
          </Match>
          <Match when={props.route.pathname === '/grant/resource' && canAdminUsers(props.user) ? props.route.grant_resource : null}>
            {(selection) => <RoleGrantByResourcePage selection={selection()} navigate={props.navigate} />}
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
  const [bootstrapError, setBootstrapError] = createSignal('');
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
    batch(() => {
      setBootstrapError('');
      setUser(current);
    });
    if (route().pathname === '/login') {
      navigate(safeRedirect(route().redirect) ?? '/meta/datasource', true);
    }
  }

  function logout() {
    clearSession();
    setUser(null);
    navigate('/login', true);
  }

  async function bootstrapUser() {
    batch(() => {
      setBooting(true);
      setBootstrapError('');
    });
    try {
      if (hasSession()) await loadUser();
      else redirectToLogin();
    } catch (error) {
      setUser(null);
      if (hasSession()) setBootstrapError((error as Error).message || '加载用户信息失败');
      else redirectToLogin();
    } finally {
      setBooting(false);
    }
  }

  const onPopState = () => {
    setRoute(readRoute());
  };
  const onAuthExpired = () => {
    setUser(null);
    redirectToLogin();
  };

  onMount(async () => {
    window.addEventListener('popstate', onPopState);
    window.addEventListener('auth-expired', onAuthExpired);
    await bootstrapUser();
  });
  onCleanup(() => {
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('auth-expired', onAuthExpired);
  });

  createEffect(() => {
    if (!booting() && !user() && !bootstrapError() && route().pathname !== '/login') redirectToLogin();
  });

  return (
    <Show when={!booting()} fallback={<div class="app-state">正在验证登录状态...</div>}>
      <Switch>
        <Match when={user()} keyed>
          {(currentUser) => <Workspace user={currentUser} route={route()} navigate={navigate} onLogout={logout} />}
        </Match>
        <Match when={bootstrapError()}>
          <div class="app-state app-error">
            <TriangleAlert size={22} />
            <span>加载用户信息失败：{bootstrapError()}</span>
            <div class="dialog-actions">
              <button type="button" class="button button-primary" onClick={() => void bootstrapUser()}><RefreshCw size={16} />重试</button>
              <button type="button" class="button button-ghost" onClick={logout}><LogOut size={16} />退出登录</button>
            </div>
          </div>
        </Match>
        <Match when><LoginPage onAuthenticated={loadUser} /></Match>
      </Switch>
    </Show>
  );
}
