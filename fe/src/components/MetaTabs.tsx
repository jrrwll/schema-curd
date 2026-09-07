import { Database, Table2 } from 'lucide-solid';

interface MetaTabsProps {
  pathname: string;
  navigate: (url: string) => void;
}

export default function MetaTabs(props: MetaTabsProps) {
  return (
    <nav class="meta-tabs" aria-label="元数据管理">
      <button
        class="meta-tab"
        classList={{ active: props.pathname.startsWith('/meta/datasource') }}
        onClick={() => props.navigate('/meta/datasource')}
      >
        <Database size={16} />数据源
      </button>
      <button
        class="meta-tab"
        classList={{ active: props.pathname.startsWith('/meta/table') }}
        onClick={() => props.navigate('/meta/table')}
      >
        <Table2 size={16} />数据表
      </button>
    </nav>
  );
}
