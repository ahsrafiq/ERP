import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, Select, Button, Space,
  Statistic, Divider, Typography, message, Empty, Tag,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  ShopOutlined, DollarOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import dayjs from 'dayjs';
import XLSXStyle from 'xlsx-js-style';

const { Title, Text } = Typography;

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment';
  reference: string;
  description: string;
  debit: number;   // purchase = debit (we owe)
  credit: number;  // payment  = credit (we paid)
  balance: number;
}

const VendorLedgerReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentCompany) loadVendors();
  }, [currentCompany]);

  useEffect(() => {
    if (selectedVendorId) loadLedger(selectedVendorId);
    else { setLedger([]); setVendorInfo(null); }
  }, [selectedVendorId]);

  const loadVendors = async () => {
    try {
      const res = await (window as any).electronAPI.db.vendors.getAll(currentCompany!.id);
      if (res.success) setVendors(res.data || []);
    } catch {/* ignore */}
  };

  const loadLedger = async (vendorId: number) => {
    setLoading(true);
    try {
      const vendor = vendors.find((v: any) => v.id === vendorId);
      setVendorInfo(vendor || null);

      const [invRes, payRes] = await Promise.all([
        (window as any).electronAPI.db.purchaseInvoices.getAll(currentCompany!.id, { vendorId }),
        (window as any).electronAPI.db.payments.getAll(currentCompany!.id, { type: 'out' }),
      ]);

      const invoices: any[] = (invRes.success ? invRes.data || [] : [])
        .filter((inv: any) => inv.vendor_id === vendorId && inv.status !== 'draft');

      const payments: any[] = (payRes.success ? payRes.data || [] : [])
        .filter((p: any) => p.vendor_id === vendorId);

      const entries: LedgerEntry[] = [
        ...invoices.map((inv: any) => ({
          id: `inv-${inv.id}`,
          date: inv.invoice_date,
          type: 'invoice' as const,
          reference: inv.invoice_number,
          description: `Purchase Invoice`,
          debit: Number(inv.total_amount || 0),
          credit: 0,
          balance: 0,
        })),
        ...payments.map((p: any) => ({
          id: `pay-${p.id}`,
          date: p.payment_date,
          type: 'payment' as const,
          reference: p.payment_number,
          description: p.notes || `Payment — ${p.payment_method || 'cash'}`,
          debit: 0,
          credit: Number(p.amount || 0),
          balance: 0,
        })),
      ].sort((a, b) => {
        const diff = dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
        if (diff !== 0) return diff;
        return a.type === 'invoice' ? -1 : 1;
      });

      let running = 0;
      entries.forEach((e) => {
        running += e.debit - e.credit;
        e.balance = running;
      });

      setLedger(entries);
    } catch {
      message.error('Failed to load vendor ledger');
    } finally {
      setLoading(false);
    }
  };

  const totalDebit  = ledger.reduce((s, e) => s + e.debit, 0);
  const totalCredit = ledger.reduce((s, e) => s + e.credit, 0);
  const closingBal  = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
  const totalInvoices = ledger.filter(e => e.type === 'invoice').length;
  const totalPayments = ledger.filter(e => e.type === 'payment').length;

  const balanceLabel = closingBal > 0 ? 'Payable' : closingBal < 0 ? 'Advance' : 'Settled';
  const balanceColor = closingBal > 0 ? '#cf1322' : closingBal < 0 ? '#1890ff' : '#52c41a';

  const columns: any[] = [
    { title: 'Sr.', key: 'sr', align: 'center' as const, width: 55, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Date', dataIndex: 'date', key: 'date', render: (v: string) => dayjs(v).format('DD-MMM-YY') },
    {
      title: 'Type', dataIndex: 'type', key: 'type',
      render: (v: string) => v === 'invoice'
        ? <Tag color="red">Purchase</Tag>
        : <Tag color="green">Payment</Tag>,
    },
    { title: 'Reference #', dataIndex: 'reference', key: 'reference' },
    { title: 'Description', dataIndex: 'description', key: 'description' },
    {
      title: 'Debit (Invoice)', dataIndex: 'debit', key: 'debit', align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#cf1322' }}>{Number(v).toLocaleString()}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Credit (Payment)', dataIndex: 'credit', key: 'credit', align: 'right' as const,
      render: (v: number) => v > 0
        ? <Text style={{ color: '#389e0d' }}>{Number(v).toLocaleString()}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Balance', dataIndex: 'balance', key: 'balance', align: 'right' as const,
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#cf1322' : v < 0 ? '#1890ff' : '#52c41a' }}>
          {Math.abs(v).toLocaleString()}
        </Text>
      ),
    },
  ];

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    if (!selectedVendorId || !vendorInfo) { message.warning('Please select a vendor first'); return; }

    const sBold   = { font: { bold: true } };
    const sHdr    = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center' } };
    const sThin   = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const sThinR  = { ...sThin, alignment: { horizontal: 'right' } };
    const sThinC  = { ...sThin, alignment: { horizontal: 'center' } };
    const sTot    = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'double' }, left: { style: 'thin' }, right: { style: 'thin' } }, fill: { fgColor: { rgb: 'F0F4FF' } } };
    const sTotR   = { ...sTot, alignment: { horizontal: 'right' } };
    const sDebit  = { ...sThinR, font: { color: { rgb: 'CF1322' } } };
    const sCredit = { ...sThinR, font: { color: { rgb: '389E0D' } } };
    const c = (v: any, s: any) => ({ v, s });

    const rows: any[][] = [];
    rows.push([c(currentCompany?.name || '', { font: { bold: true, sz: 14 } })]);
    rows.push([c('Vendor Ledger Report', { font: { bold: true, sz: 12 } })]);
    rows.push([c(`Vendor: ${vendorInfo.name}${vendorInfo.phone ? ' | ' + vendorInfo.phone : ''}`, { font: { italic: true } })]);
    rows.push([]);

    const headers = ['Sr.', 'Date', 'Type', 'Reference #', 'Description', 'Debit (Invoice)', 'Credit (Payment)', 'Balance'];
    rows.push(headers.map(h => c(h, sHdr)));

    ledger.forEach((e, i) => {
      rows.push([
        c(i + 1, sThinC),
        c(dayjs(e.date).format('DD-MMM-YY'), sThin),
        c(e.type === 'invoice' ? 'Purchase' : 'Payment', sThinC),
        c(e.reference, sThin),
        c(e.description, sThin),
        e.debit > 0 ? c(e.debit, sDebit) : c('—', sThinC),
        e.credit > 0 ? c(e.credit, sCredit) : c('—', sThinC),
        c(Math.abs(e.balance), sTotR),
      ]);
    });

    rows.push([
      c('', sTot), c('', sTot), c('', sTot), c('', sTot),
      c('TOTAL', sTot), c(totalDebit, sTotR), c(totalCredit, sTotR),
      c(`${Math.abs(closingBal).toLocaleString()} (${balanceLabel})`, sTotR),
    ]);

    const ws: any = {};
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        ws[XLSXStyle.utils.encode_cell({ r: ri, c: ci })] = cell;
      });
    });
    ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: headers.length - 1 } });
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    ];
    ws['!cols'] = [{ wch: 25 }, { wch: 13 }, { wch: 12 }, { wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 18 }];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Vendor Ledger');
    XLSXStyle.writeFile(wb, `Vendor_Ledger_${vendorInfo.name.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
          <Title level={4} style={{ margin: 0 }}>Vendor Ledger</Title>
        </Space>
        <Space>
          <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} disabled={!selectedVendorId} style={{ color: '#217346', borderColor: '#217346' }}>Export Excel</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!selectedVendorId}>Print</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            showSearch
            placeholder="Choose a vendor..."
            value={selectedVendorId}
            onChange={setSelectedVendorId}
            style={{ width: 320 }}
            options={vendors.map((v: any) => ({ label: `${v.name}${v.code ? ' (' + v.code + ')' : ''}`, value: v.id }))}
            filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
            allowClear
          />
          {vendorInfo && (
            <Space>
              {vendorInfo.phone && <Text type="secondary"><ShopOutlined /> {vendorInfo.phone}</Text>}
              {vendorInfo.address && <Text type="secondary">{vendorInfo.address}</Text>}
            </Space>
          )}
        </Space>
      </Card>

      {selectedVendorId && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card><Statistic title="Purchase Invoices" value={totalInvoices} prefix={<FileTextOutlined />} /></Card>
          </Col>
          <Col span={4}>
            <Card><Statistic title="Payments Made" value={totalPayments} prefix={<DollarOutlined />} /></Card>
          </Col>
          <Col span={5}>
            <Card><Statistic title="Total Purchased" value={totalDebit} precision={0} formatter={(v) => Number(v).toLocaleString()} valueStyle={{ color: '#cf1322' }} /></Card>
          </Col>
          <Col span={5}>
            <Card><Statistic title="Total Paid" value={totalCredit} precision={0} formatter={(v) => Number(v).toLocaleString()} valueStyle={{ color: '#389e0d' }} /></Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={`Closing Balance (${balanceLabel})`}
                value={Math.abs(closingBal)}
                precision={0}
                formatter={(v) => Number(v).toLocaleString()}
                valueStyle={{ color: balanceColor }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {!selectedVendorId ? (
        <Empty description="Select a vendor to view their ledger" />
      ) : (
        <Table
          dataSource={ledger}
          columns={columns}
          loading={loading}
          rowKey="id"
          size="small"
          bordered
          pagination={false}
          rowClassName={(row) => row.type === 'payment' ? 'payment-row' : ''}
          summary={() => (
            <Table.Summary.Row style={{ fontWeight: 'bold', background: '#f0f4ff' }}>
              <Table.Summary.Cell index={0} colSpan={5} align="right">TOTAL</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text style={{ color: '#cf1322', fontWeight: 'bold' }}>{totalDebit.toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <Text style={{ color: '#389e0d', fontWeight: 'bold' }}>{totalCredit.toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <Text strong style={{ color: balanceColor }}>
                  {Math.abs(closingBal).toLocaleString()} ({balanceLabel})
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      )}

      <Divider />
      <Text type="secondary" style={{ fontSize: 11 }}>
        Generated on {dayjs().format('DD-MMM-YYYY HH:mm')} · {currentCompany?.name}
      </Text>
    </div>
  );
};

export default VendorLedgerReport;
