import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Typography, Input, notification, Tag, Select } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const CustomerOutstandingReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => {
    if (!currentCompany) return;
    void (async () => {
      setLoading(true);
      try {
        const [custRes, invRes] = await Promise.all([
          (window as any).electronAPI.db.customers.getAll(currentCompany.id),
          (window as any).electronAPI.db.salesInvoices.getPendingWithItems(currentCompany.id)
        ]);

        if (custRes?.success) setCustomers(custRes.data || []);
        else setCustomers([]);

        if (invRes?.success) {
          setInvoices(invRes.data || []);
        } else {
          setInvoices([]);
        }
      } catch {
        notification.error({ message: 'Error', description: 'Failed to load report data', duration: 0 });
        setCustomers([]);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentCompany]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return invoices
      .filter((inv: any) => (selectedCustomerId ? Number(inv.customer_id) === Number(selectedCustomerId) : true))
      .filter((inv: any) => {
        if (!q) return true;
        return (
          (inv.invoice_number || '').toLowerCase().includes(q) ||
          (inv.customer_name || '').toLowerCase().includes(q) ||
          (inv.po_number || '').toLowerCase().includes(q)
        );
      });
    // We include searchTrigger to allow manual re-calc if needed, though useMemo is reactive to others
  }, [invoices, searchQuery, selectedCustomerId, searchTrigger]);

  const handleSearch = () => {
    setSearchTrigger(prev => prev + 1);
  };

  const itemColumns = [
    { title: 'Item', dataIndex: 'item_name', render: (v: string, r: any) => v || r.description || '-' },
    { title: 'Brand', dataIndex: 'brand' },
    { title: 'Qty', dataIndex: 'quantity', align: 'right' as const },
    { title: 'Rate', dataIndex: 'unit_price', align: 'right' as const, render: (v: number) => Number(v || 0).toLocaleString() },
    { title: 'Total', dataIndex: 'line_total', align: 'right' as const, render: (v: number) => <strong>{Number(v || 0).toLocaleString()}</strong> },
  ];

  const columns = [
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      key: 'date',
      width: 120,
      render: (v: string) => dayjs(v).format('DD-MMM-YYYY')
    },
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      width: 140,
      render: (v: string) => <Text strong>{v}</Text>
    },
    {
      title: 'Customer',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (v: string) => <Text>{v}</Text>
    },
    {
      title: 'PO #',
      dataIndex: 'po_number',
      key: 'po_number',
      render: (v: string) => v || '—'
    },
    {
      title: currentCompany?.is_gst_enabled ? 'Amount (incl GST)' : 'Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString()
    },
    {
      title: 'Balance Due',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => <span style={{ color: '#cf1322', fontWeight: 700 }}>{Number(v || 0).toLocaleString()}</span>
    },
    {
      title: 'Overdue',
      key: 'overdue',
      width: 120,
      render: (_: any, inv: any) => {
        if (!inv?.due_date) return '—';
        const due = dayjs(inv.due_date);
        const diff = dayjs().diff(due, 'days');
        return diff > 0 ? <Tag color="error">{diff} Days</Tag> : <Tag color="success">Not Due</Tag>;
      }
    }
  ];

  const totalOutstanding = useMemo(() => {
    return filteredInvoices.reduce((s, inv) => s + (Number(inv.balance) || 0), 0);
  }, [filteredInvoices]);

  const expandedRowRender = (record: any) => {
    return (
      <Table
        columns={itemColumns}
        dataSource={record.items}
        pagination={false}
        size="small"
        rowKey="id"
        style={{ margin: '8px 0', backgroundColor: '#f9f9f9', border: '1px solid #f0f0f0', borderRadius: 4 }}
      />
    );
  };

  return (
    <div style={{ padding: '0 24px 24px 24px' }}>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Customer Outstanding — {currentCompany?.name}</Title>
          </Space>
          <Space size="middle">
            <Select
              allowClear
              showSearch
              placeholder="All customers"
              style={{ width: 280 }}
              value={selectedCustomerId ?? undefined}
              onChange={(value) => setSelectedCustomerId(value ?? null)}
              optionFilterProp="label"
              options={customers
                .filter((c: any) => Number(c.balance) > 0)
                .map((c: any) => ({
                  value: c.id,
                  label: `${c.name || 'Customer'}${c.code ? ` (${c.code})` : ''}`,
                }))}
            />
            <Input
              allowClear
              value={searchQuery}
              placeholder="Search Invoice #, Customer, PO #"
              prefix={<SearchOutlined />}
              style={{ width: 260 }}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              Search
            </Button>
            <Button
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              disabled={filteredInvoices.length === 0}
            >
              Print
            </Button>
          </Space>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Total Outstanding Items</div>
            <div style={{ fontWeight: 800, color: '#cf1322', fontSize: 18 }}>{totalOutstanding.toLocaleString()}</div>
          </div>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Count</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{filteredInvoices.length} Invoices</div>
          </div>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>As on</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{dayjs().format('DD-MMM-YYYY')}</div>
          </div>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={filteredInvoices}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        expandable={{
          expandedRowRender,
          defaultExpandAllRows: true
        }}
        scroll={{ x: 1000 }}
        bordered
      />

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .ant-table-expanded-row { background-color: #f9f9f9 !important; }
        }
      `}</style>
    </div>
  );
};

export default CustomerOutstandingReport;

