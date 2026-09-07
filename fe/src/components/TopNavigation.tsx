import { Database, LogOut, UserRound, Users, Wrench } from 'lucide-solid';
import { Show } from 'solid-js';
import { canAdminUsers } from '../session';
import type { CurrentUser, RouteState } from '../types';

interface TopNavigationProps {
  user: CurrentUser;
  route: RouteState;
  navigate: (url: string) => void;
  onLogout: () => void;
}

export default function TopNavigation(props: TopNavigationProps) {
  return (
    <header class="top-navigation">
      <button class="top-brand" title="数据源" onClick={() => props.navigate('/meta/datasource')}>
        <span class="top-brand-mark"><Database size={18} /></span>
        <span>Schema CURD</span>
      </button>
      <nav class="top-nav-items" aria-label="主导航">
        <button
          class="top-nav-item"
          classList={{ active: props.route.pathname.startsWith('/meta') }}
          onClick={() => props.navigate('/meta/datasource')}
        >
          <Database size={16} />元数据
        </button>
        <button
          class="top-nav-item"
          classList={{ active: props.route.pathname.startsWith('/entity') }}
          onClick={() => props.navigate('/entity')}
        >
          <Wrench size={16} />实体数据
        </button>
        <Show when={canAdminUsers(props.user)}>
          <button
            class="top-nav-item"
            classList={{ active: props.route.pathname.startsWith('/user') || props.route.pathname.startsWith('/grant') }}
            onClick={() => props.navigate('/user')}
          >
            <Users size={16} />用户
          </button>
        </Show>
      </nav>
      <div class="top-account">
        <UserRound size={16} />
        <span><strong>{props.user.display_name}</strong><small>{props.user.name}</small></span>
        <button title="退出登录" aria-label="退出登录" onClick={props.onLogout}><LogOut size={16} /></button>
      </div>
    </header>
  );
}
