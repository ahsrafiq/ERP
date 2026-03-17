import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, DatePicker, Select, Button, Space,
  Statistic, Divider, Typography, notification, Tag,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, HistoryOutlined,
  ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const StockMovementReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [movements, setMovements] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[any, any]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  useEffect(() => {
    if (currentCompany) {
      loadItems();
    }
  }, [currentCompany]);

  const loadItems = async () => {
    try {
      const res = await (window as any).electronAPI.db.items.getAll(currentCompany?.id);
      if (res.success) setItems(res.data || []);
    } catch { /* ignore */ }
  };

  const loadMovements = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (dateRange[0]) filters.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) filters.toDate = dateRange[1].format('YYYY-MM-DD');
      if (selectedItemId) filters.itemId = selectedItemId;

      const res = await (window as any).electronAPI.db.items.getStockMovement(currentCompany.id, filters);
      if (res.success) {
        setMovements(res.data || []);
      } else {
        notification.error({ message: 'Error', description: 'Failed to load stock movements' });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load stock movements' });
    } finally {
      setLoading(false);
    }
  };

  const totalIn = movements.filter(m => m.type === 'Inbound').reduce((s, m) => s + (m.quantity || 0), 0);
  const totalOut = movements.filter(m => m.type === 'Outbound').reduce((s, m) => s + (m.quantity || 0), 0);

  const columns = [
    {
      title: 'Sr.',
      key: 'sr',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => dayjs(d).format('DD-MM-YYYY'),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => (
        <Tag color={t === 'Inbound' ? 'green' : 'orange'} icon={t === 'Inbound' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
          {t.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Reference #',
      dataIndex: 'reference',
      key: 'reference',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Vendor/Customer',
      dataIndex: 'partner_name',
      key: 'partner_name',
      render: (v: string) => v || '—',
    },
    {
      title: 'Item Name',
      dataIndex: 'item_name',
      key: 'item_name',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (v: number, row: any) => (
        <Text type={row.type === 'Inbound' ? 'success' : 'danger'} strong>
          {row.type === 'Inbound' ? '+' : '-'}{v}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Stock Movement Report — {currentCompany?.name}</Title>
          </Space>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print
          </Button>
        </div>

        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <RangePicker
              value={dateRange}
              onChange={(dates: any) => setDateRange(dates)}
              format="DD-MM-YYYY"
            />
            <Select
              allowClear
              showSearch
              placeholder="All Items"
              style={{ width: 250 }}
              value={selectedItemId}
              onChange={setSelectedItemId}
              options={items.map(i => ({ label: i.name, value: i.id }))}
              optionFilterProp="label"
            />
            <Button type="primary" onClick={loadMovements}>Search</Button>
          </Space>
        </Card>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic title="Total Movements" value={movements.length} prefix={<HistoryOutlined />} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="Total Inbound" value={totalIn} valueStyle={{ color: '#3f8600' }} prefix={<ArrowUpOutlined />} />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic title="Total Outbound" value={totalOut} valueStyle={{ color: '#cf1322' }} prefix={<ArrowDownOutlined />} />
            </Card>
          </Col>
        </Row>
      </div>

      <div className="print-only" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
        <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Stock Movement Report</Title>
        <Text style={{ display: 'block', textAlign: 'center', color: '#888' }}>
          Period: {dateRange[0]?.format('DD-MM-YYYY')} — {dateRange[1]?.format('DD-MM-YYYY')}
          {selectedItemId && ` | Item: ${items.find(i => i.id === selectedItemId)?.name}`}
        </Text>
        <Divider style={{ margin: '8px 0' }} />
      </div>

      <Table
        dataSource={movements}
        columns={columns}
        rowKey={(row) => `${row.type}-${row.reference}-${row.item_name}`}
        loading={loading}
        pagination={false}
        size="small"
        bordered
      />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .app-sider, .app-header { display: none !important; }
          .app-layout { margin: 0 !important; }
          .app-content { padding: 0 !important; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>
    </div>
  );
};

export default StockMovementReport;
