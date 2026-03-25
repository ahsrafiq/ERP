import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Typography, Input, notification, Tag, Select } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';

const { Title } = Typography;

const CustomerOutstandingReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  useEffect(() => {
    if (!currentCompany) return;
    void (async () => {
      setLoading(true);
      try {
        const [custRes, invRes] = await Promise.all([
          (window as any).electronAPI.db.customers.getAll(currentCompany.id),
          (window as any).electronAPI.db.salesInvoices.getAll(currentCompany.id)
        ]);

        if (custRes?.success) setCustomers(custRes.data || []);
        else setCustomers([]);

        if (invRes?.success) {
          const pending = (invRes.data || []).filter((inv: any) => Number(inv.balance) > 0);
          setInvoices(pending);
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

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return (customers || [])
      .filter((c: any) => Number(c.balance) > 0)
      .filter((c: any) => (selectedCustomerId ? c.id === selectedCustomerId : true))
      .filter((c: any) => {
        if (!q) return true;
        return (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q);
      });
  }, [customers, searchQuery, selectedCustomerId]);

  const expandedRowRender = (record: any) => {
    const custInvoices = invoices.filter(inv => inv.customer_id === record.id);
    const invColumns = [
      { title: 'Date', dataIndex: 'invoice_date', key: 'date', render: (v: string) => dayjs(v).format('DD-MMM-YYYY') },
      { title: 'Invoice #', dataIndex: 'invoice_number', key: 'inv_num' },
      { title: 'PO #', dataIndex: 'po_number', key: 'po', render: (v: any) => v || '—' },
      { 
        title: currentCompany?.is_gst_enabled ? 'Amount (incl GST)' : 'Amount',
        dataIndex: 'total_amount',
        key: 'amt',
        align: 'right' as const,
        render: (v: number) => <strong>{Number(v || 0).toLocaleString()}</strong>,
      },
      { 
        title: 'Balance', 
        dataIndex: 'balance', 
        key: 'bal', 
        align: 'right' as const,
        render: (v: number) => <strong>{v.toLocaleString()}</strong> 
      },
      {
        title: 'Overdue Days',
        key: 'overdue',
        render: (_: any, inv: any) => {
          if (!inv?.due_date) return '—';
          const due = dayjs(inv.due_date);
          const diff = dayjs().diff(due, 'days');
          return diff > 0 ? <Tag color="error">{diff} Days</Tag> : <Tag color="success">Not Due</Tag>;
        }
      }
    ];

    return (
      <Table 
        columns={invColumns} 
        dataSource={custInvoices} 
        pagination={false} 
        size="small" 
        rowKey="id"
      />
    );
  };

  const columns = [
    {
      title: 'Sr.',
      key: 'sr',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, i: number) => i + 1,
    },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100, render: (v: any) => (v ? String(v) : '—') },
    {
      title: 'Customer',
      dataIndex: 'name',
      key: 'name',
      render: (v: any, row: any) => (
        <div>
          <span style={{ fontWeight: 600 }}>{v ? String(v) : '—'}</span>
          {row.phone ? <div style={{ fontSize: 11, color: '#888' }}>{row.phone}</div> : null}
        </div>
      ),
    },
    {
      title: 'Outstanding',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (v: any) => <span style={{ color: '#cf1322', fontWeight: 700 }}>{Number(v || 0).toLocaleString()}</span>,
    },
  ];

  const totalOutstanding = useMemo(() => {
    return filtered.reduce((s: number, c: any) => s + (Number(c.balance) || 0), 0);
  }, [filtered]);

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Customer Outstanding — {currentCompany?.name}</Title>
          </Space>
          <Space>
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
              placeholder="Search by name or code"
              prefix={<SearchOutlined />}
              style={{ width: 260 }}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
              disabled={filtered.length === 0}
            >
              Print
            </Button>
          </Space>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Total Outstanding</div>
            <div style={{ fontWeight: 800, color: '#cf1322' }}>{totalOutstanding.toLocaleString()}</div>
          </div>
          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: '#666' }}>As on</div>
            <div style={{ fontWeight: 600 }}>{dayjs().format('DD-MMM-YYYY')}</div>
          </div>
        </div>
      </div>

      <Table
        className="print-only"
        columns={columns}
        dataSource={filtered}
        rowKey={(r: any) => String(r?.id || Math.random())}
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender,
          defaultExpandAllRows: true
        }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
};

export default CustomerOutstandingReport;

