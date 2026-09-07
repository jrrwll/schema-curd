import { ShieldCheck, Users } from 'lucide-solid';

interface UserTabsProps {
  pathname: string;
  navigate: (url: string) => void;
}

export default function UserTabs(props: UserTabsProps) {
  return (
    <nav class="meta-tabs" aria-label="用户管理">
      <button class="meta-tab" classList={{ active: props.pathname.startsWith('/user') }} onClick={() => props.navigate('/user')}>
        <Users size={16} />用户管理
      </button>
      <button class="meta-tab" classList={{ active: props.pathname === '/grant' }} onClick={() => props.navigate('/grant')}>
        <ShieldCheck size={16} />授权管理
      </button>
    </nav>
  );
}
