import React, { useState, useEffect } from 'react';
import {
  Table, Card, Row, Col, Select, Button, Space,
  Statistic, Divider, Typography, notification, message, Input, Tag,
} from 'antd';
import {
  PrinterOutlined, ArrowLeftOutlined, FileExcelOutlined,
  DatabaseOutlined, DollarOutlined, AppstoreOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import XLSXStyle from 'xlsx-js-style';

const { Title, Text } = Typography;
const { Search } = Input;

const InventoryReport: React.FC = () => {
  const { currentCompany } = useApp();
  const navigate = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    loadItems();
  }, [currentCompany]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await (window as any).electronAPI.db.items.getAll(currentCompany?.id);
      if (res.success) {
        setItems(res.data || []);
        notification.error({ message: 'Error', description: 'Failed to load items', duration: 0 });
      }
    } catch {
      notification.error({ message: 'Error', description: 'Failed to load items', duration: 0 });
    } finally {
      setLoading(false);
    }
  };

  // Unique locations and brands for filters
  const locationOptions = Array.from(new Set(items.map((i) => i.location).filter(Boolean))).sort();
  const brandOptions = Array.from(new Set(items.map((i) => i.brand_name).filter(Boolean))).sort();

  const filtered = items.filter((item) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !item.name?.toLowerCase().includes(q) &&
        !item.code?.toLowerCase().includes(q) &&
        !item.description?.toLowerCase().includes(q)
      ) return false;
    }
    if (selectedLocation && item.location !== selectedLocation) return false;
    if (selectedBrand && item.brand_name !== selectedBrand) return false;
    if (lowStockOnly && Number(item.quantity) > Number(item.reorder_level || 0)) return false;
    return true;
  });

  const totalItems = filtered.length;
  const totalQty = filtered.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  const totalPurchaseValue = filtered.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.purchase_price) || 0), 0);
  const totalSellingValue = filtered.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.selling_price) || 0), 0);
  const lowStockCount = filtered.filter((i) => Number(i.quantity) <= Number(i.reorder_level || 0) && Number(i.reorder_level || 0) > 0).length;

  const columns = [
    {
      title: 'Sr.',
      key: 'sr',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Brand',
      dataIndex: 'brand_name',
      key: 'brand_name',
      render: (v: string) => v || '—',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (v: string) => v
        ? <Tag color="blue" style={{ fontWeight: 600 }}>{v}</Tag>
        : '—',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => v || '—',
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (v: number, row: any) => {
        const qty = Number(v) || 0;
        const reorder = Number(row.reorder_level) || 0;
        const isLow = reorder > 0 && qty <= reorder;
        return (
          <Text type={isLow ? 'danger' : undefined} strong={isLow}>
            {qty}
            {isLow && <WarningOutlined style={{ marginLeft: 4 }} />}
          </Text>
        );
      },
    },
    {
      title: 'Reorder Level',
      dataIndex: 'reorder_level',
      key: 'reorder_level',
      align: 'right' as const,
      render: (v: number) => Number(v) || 0,
    },
    {
      title: 'Purchase Price',
      dataIndex: 'purchase_price',
      key: 'purchase_price',
      align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString(),
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      key: 'selling_price',
      align: 'right' as const,
      render: (v: number) => Number(v || 0).toLocaleString(),
    },
    {
      title: 'Purchase Value',
      key: 'purchase_value',
      align: 'right' as const,
      render: (_: any, row: any) => ((Number(row.quantity) || 0) * (Number(row.purchase_price) || 0)).toLocaleString(),
    },
    {
      title: 'Selling Value',
      key: 'selling_value',
      align: 'right' as const,
      render: (_: any, row: any) => (
        <Text strong>
          {((Number(row.quantity) || 0) * (Number(row.selling_price) || 0)).toLocaleString()}
        </Text>
      ),
    },
  ];

  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row style={{ fontWeight: 700, background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={6} align="right">
          <Text strong>Total ({totalItems} items)</Text>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1} align="right">{totalQty}</Table.Summary.Cell>
        <Table.Summary.Cell index={2} />
        <Table.Summary.Cell index={3} />
        <Table.Summary.Cell index={4} />
        <Table.Summary.Cell index={5} align="right">{totalPurchaseValue.toLocaleString()}</Table.Summary.Cell>
        <Table.Summary.Cell index={6} align="right">
          <Text strong>{totalSellingValue.toLocaleString()}</Text>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  // ── Excel Export ──────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const companyName = currentCompany?.name || 'Company';
    const dateStr = new Date().toLocaleDateString('en-GB');

    const thinBorder = {
      top:    { style: 'thin', color: { rgb: 'AAAAAA' } },
      bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
      left:   { style: 'thin', color: { rgb: 'AAAAAA' } },
      right:  { style: 'thin', color: { rgb: 'AAAAAA' } },
    };
    const thickBottom = {
      top:    { style: 'thin',   color: { rgb: 'AAAAAA' } },
      bottom: { style: 'medium', color: { rgb: '000000' } },
      left:   { style: 'thin',   color: { rgb: 'AAAAAA' } },
      right:  { style: 'thin',   color: { rgb: 'AAAAAA' } },
    };

    const styleTitle = { font: { bold: true, sz: 16, color: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const styleSubTitle = { font: { bold: true, sz: 13, color: { rgb: '2F5496' } }, alignment: { horizontal: 'center' } };
    const styleMeta = { font: { sz: 10, italic: true, color: { rgb: '555555' } }, alignment: { horizontal: 'center' } };
    const styleColHeader = {
      font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '2F5496' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: thinBorder,
    };
    const styleColHeaderRight = { ...styleColHeader, alignment: { horizontal: 'right', vertical: 'center' } };
    const styleData    = { font: { sz: 10 }, alignment: { vertical: 'center' }, border: thinBorder };
    const styleDataRight = { font: { sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder };
    const styleDataBoldRight = { font: { bold: true, sz: 10 }, alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder };
    const styleDataLowStock = { font: { bold: true, sz: 10, color: { rgb: 'C00000' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder };
    const styleTotals = {
      font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F3864' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: thickBottom,
    };
    const styleSummaryLabel = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: thinBorder };
    const styleSummaryValue = { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'DCE6F1' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: thinBorder };

    const c = (v: any, s: any = {}) => ({ v, s });
    const numCols = 12;

    const colHeaders = [
      c('Sr.',            styleColHeader),
      c('Code',           styleColHeader),
      c('Name',           styleColHeader),
      c('Brand',          styleColHeader),
      c('Location',       styleColHeader),
      c('Description',    styleColHeader),
      c('Qty',            styleColHeaderRight),
      c('Reorder Level',  styleColHeaderRight),
      c('Purchase Price', styleColHeaderRight),
      c('Selling Price',  styleColHeaderRight),
      c('Purchase Value', styleColHeaderRight),
      c('Selling Value',  styleColHeaderRight),
    ];

    const dataRows = filtered.map((item, i) => {
      const qty     = Number(item.quantity) || 0;
      const reorder = Number(item.reorder_level) || 0;
      const isLow   = reorder > 0 && qty <= reorder;
      const purchaseVal = qty * (Number(item.purchase_price) || 0);
      const sellingVal  = qty * (Number(item.selling_price)  || 0);
      return [
        c(i + 1,                     styleData),
        c(item.code || '',           styleData),
        c(item.name || '',           styleData),
        c(item.brand_name || '',     styleData),
        c(item.location || '',       styleData),
        c(item.description || '',    styleData),
        c(qty,                       isLow ? styleDataLowStock : styleDataRight),
        c(reorder,                   styleDataRight),
        c(Number(item.purchase_price) || 0, styleDataRight),
        c(Number(item.selling_price)  || 0, styleDataRight),
        c(purchaseVal,               styleDataRight),
        c(sellingVal,                styleDataBoldRight),
      ];
    });

    const totalsRow = [
      c('',                        styleTotals),
      c('',                        styleTotals),
      c('TOTAL',                   styleTotals),
      c('',                        styleTotals),
      c('',                        styleTotals),
      c(`${totalItems} items`,     styleTotals),
      c(totalQty,                  styleTotals),
      c('',                        styleTotals),
      c('',                        styleTotals),
      c('',                        styleTotals),
      c(totalPurchaseValue,        styleTotals),
      c(totalSellingValue,         styleTotals),
    ];

    const summaryRows: any[][] = [
      [],
      [c('Summary', { font: { bold: true, sz: 11 } })],
      [c('Total Items',           styleSummaryLabel), c(''), c(''), c(totalItems,          styleSummaryValue)],
      [c('Total Quantity',        styleSummaryLabel), c(''), c(''), c(totalQty,            styleSummaryValue)],
      [c('Total Purchase Value',  styleSummaryLabel), c(''), c(''), c(totalPurchaseValue,  styleSummaryValue)],
      [c('Total Selling Value',   styleSummaryLabel), c(''), c(''), c(totalSellingValue,   styleSummaryValue)],
      [c('Low Stock Items',       styleSummaryLabel), c(''), c(''), c(lowStockCount,       styleSummaryValue)],
    ];

    const wsData: any[][] = [
      [c(companyName, styleTitle)],
      [c('Inventory Report', styleSubTitle)],
      [c(`Generated: ${dateStr}${selectedLocation ? '  |  Location: ' + selectedLocation : ''}${selectedBrand ? '  |  Brand: ' + selectedBrand : ''}`, styleMeta)],
      [],
      colHeaders,
      ...dataRows,
      totalsRow,
      ...summaryRows,
    ];

    const ws: any = XLSXStyle.utils.aoa_to_sheet(wsData);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
    ];

    ws['!cols'] = [
      { wch: 25 }, // Sr. / summary labels
      { wch: 10 }, // Code
      { wch: 28 }, // Name
      { wch: 16 }, // Brand
      { wch: 12 }, // Location
      { wch: 30 }, // Description
      { wch: 8  }, // Qty
      { wch: 13 }, // Reorder
      { wch: 15 }, // Purchase Price
      { wch: 14 }, // Selling Price
      { wch: 16 }, // Purchase Value
      { wch: 15 }, // Selling Value
    ];

    ws['!rows'] = [
      { hpt: 26 }, // company name
      { hpt: 20 }, // report title
      { hpt: 16 }, // meta
      { hpt: 6  }, // blank
      { hpt: 22 }, // col headers
    ];

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Inventory Report');
    XLSXStyle.writeFile(wb, `Inventory_Report_${dateStr.replace(/\//g, '-')}.xlsx`);
    message.success('Exported to Excel successfully');
  };

  return (
    <div>
      {/* Screen controls */}
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/reports')}>Back</Button>
            <Title level={4} style={{ margin: 0 }}>Inventory Report — {currentCompany?.name}</Title>
          </Space>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              style={{ color: '#217346', borderColor: '#217346' }}
              onClick={handleExportExcel}
            >
              Export Excel
            </Button>
            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
            </Button>
          </Space>
        </div>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }} size="small">
          <Space wrap>
            <Search
              placeholder="Search by name, code, description…"
              allowClear
              style={{ width: 280 }}
              onSearch={setSearchText}
              onChange={(e) => !e.target.value && setSearchText('')}
            />
            <Select
              allowClear
              placeholder="All Locations"
              style={{ width: 160 }}
              value={selectedLocation}
              onChange={setSelectedLocation}
              options={locationOptions.map((l) => ({ label: l, value: l }))}
            />
            <Select
              allowClear
              placeholder="All Brands"
              style={{ width: 160 }}
              value={selectedBrand}
              onChange={setSelectedBrand}
              options={brandOptions.map((b) => ({ label: b, value: b }))}
            />
            <Button
              type={lowStockOnly ? 'primary' : 'default'}
              danger={lowStockOnly}
              icon={<WarningOutlined />}
              onClick={() => setLowStockOnly(!lowStockOnly)}
            >
              Low Stock Only
            </Button>
            <Button onClick={loadItems}>Refresh</Button>
          </Space>
        </Card>

        {/* KPI Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="Total Items" value={totalItems} prefix={<AppstoreOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="Total Quantity" value={totalQty} prefix={<DatabaseOutlined />} formatter={(v) => Number(v).toLocaleString()} />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Card size="small">
              <Statistic
                title="Purchase Stock Value"
                value={totalPurchaseValue}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#1890ff' }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={5}>
            <Card size="small">
              <Statistic
                title="Selling Stock Value"
                value={totalSellingValue}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#52c41a' }}
                formatter={(v) => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="Low Stock Items"
                value={lowStockCount}
                prefix={<WarningOutlined />}
                valueStyle={{ color: lowStockCount > 0 ? '#ff4d4f' : undefined }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* Print header */}
      <div className="print-only" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ textAlign: 'center', margin: 0 }}>{currentCompany?.name}</Title>
        <Title level={5} style={{ textAlign: 'center', margin: 0, color: '#666' }}>Inventory Report</Title>
        <Text style={{ display: 'block', textAlign: 'center', color: '#888', marginBottom: 4 }}>
          Generated: {new Date().toLocaleDateString('en-GB')}
          {selectedLocation && ` | Location: ${selectedLocation}`}
          {selectedBrand && ` | Brand: ${selectedBrand}`}
          {lowStockOnly && ' | Low Stock Only'}
        </Text>
        <Divider style={{ margin: '8px 0' }} />
        <Row gutter={[24, 4]} style={{ marginBottom: 12 }}>
          <Col span={4}><Text>Items: <strong>{totalItems}</strong></Text></Col>
          <Col span={4}><Text>Total Qty: <strong>{totalQty}</strong></Text></Col>
          <Col span={6}><Text>Purchase Value: <strong>{totalPurchaseValue.toLocaleString()}</strong></Text></Col>
          <Col span={6}><Text>Selling Value: <strong>{totalSellingValue.toLocaleString()}</strong></Text></Col>
          <Col span={4}><Text>Low Stock: <strong style={{ color: lowStockCount > 0 ? '#ff4d4f' : undefined }}>{lowStockCount}</strong></Text></Col>
        </Row>
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        bordered
        summary={summaryRow}
        rowClassName={(row) => {
          const qty = Number(row.quantity) || 0;
          const reorder = Number(row.reorder_level) || 0;
          return reorder > 0 && qty <= reorder ? 'low-stock-row' : '';
        }}
      />

      <style>{`
        .low-stock-row { background: #fff2f0 !important; }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .app-sider, .app-header { display: none !important; }
          .app-layout { margin: 0 !important; }
          .app-content { padding: 0 !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
};

export default InventoryReport;
