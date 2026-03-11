import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Radio, Spin } from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  UserOutlined,
  ShopOutlined,
  RiseOutlined,
  InboxOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { useApp } from '../../context/AppContext';
import './Dashboard.css';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Dashboard: React.FC = () => {
  const { currentCompany } = useApp();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [kpis, setKpis] = useState<any>({});
  const [salesVsPurchase, setSalesVsPurchase] = useState<any>({ sales: [], purchases: [] });
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    if (currentCompany) {
      loadDashboardData();
    }
  }, [currentCompany, dateRange, period]);

  const loadDashboardData = async () => {
    if (!currentCompany) return;

    setLoading(true);
    try {
      const filters = {
        fromDate: dateRange[0].format('YYYY-MM-DD'),
        toDate: dateRange[1].format('YYYY-MM-DD'),
      };

      // Load KPIs
      const kpiResult = await (window as any).electronAPI.db.dashboard.getKPIs(currentCompany.id, filters);
      const kpiData = kpiResult.success ? (kpiResult.data || {}) : {};
      // Total items: use items.getAll count so it matches the Items list and is reliable
      try {
        const itemsResult = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
        if (itemsResult.success && Array.isArray(itemsResult.data)) {
          kpiData.totalItems = itemsResult.data.length;
        }
      } catch (_) {}
      setKpis(kpiData);

      // Load Sales vs Purchase
      const spResult = await (window as any).electronAPI.db.dashboard.getSalesVsPurchase(currentCompany.id, filters);
      if (spResult.success) {
        setSalesVsPurchase(spResult.data || { sales: [], purchases: [] });
      }

      // Load Expense Breakdown
      const expResult = await (window as any).electronAPI.db.dashboard.getExpenseBreakdown(currentCompany.id, filters);
      if (expResult.success) {
        setExpenseBreakdown(expResult.data || []);
      }

      // Load Monthly Revenue
      const revResult = await (window as any).electronAPI.db.dashboard.getMonthlyRevenue(currentCompany.id, filters);
      if (revResult.success) {
        setMonthlyRevenue(revResult.data || []);
      }

      // Load Top Customers
      const custResult = await (window as any).electronAPI.db.dashboard.getTopCustomers(currentCompany.id, filters);
      if (custResult.success) {
        setTopCustomers(custResult.data || []);
      }

      // Load all customers and items for card lists
      try {
        const custAllResult = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
        if (custAllResult.success && Array.isArray(custAllResult.data)) {
          setCustomers(custAllResult.data);
        }
      } catch (_) {}
      try {
        const itemsResult = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
        if (itemsResult.success && Array.isArray(itemsResult.data)) {
          setItems(itemsResult.data);
        }
      } catch (_) {}
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareSalesVsPurchaseData = () => {
    const salesMap = new Map(salesVsPurchase.sales.map((s: any) => [s.date, s.amount]));
    const purchaseMap = new Map(salesVsPurchase.purchases.map((p: any) => [p.date, p.amount]));
    const allDates = new Set([...salesMap.keys(), ...purchaseMap.keys()]);
    
    return Array.from(allDates).sort().map(date => ({
      date: dayjs(date).format('MMM DD'),
      sales: salesMap.get(date) || 0,
      purchases: purchaseMap.get(date) || 0,
    }));
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card>
                <Statistic
                  title="Customer Outstanding"
                  value={kpis.customerOutstanding || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#cf1322' }}
                />
                <div style={{ marginTop: 12, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
                  <strong>Customers with balance:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {customers.filter((c: any) => (c.balance || 0) > 0).length === 0 ? (
                      <li key="none">None</li>
                    ) : (
                      customers.filter((c: any) => (c.balance || 0) > 0).map((c: any) => (
                        <li key={c.id}>{c.name} ({Number(c.balance || 0).toLocaleString()})</li>
                      ))
                    )}
                  </ul>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card>
                <Statistic
                  title="Total Customer Limit"
                  value={kpis.totalCustomerLimit || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#3f8600' }}
                />
                <div style={{ marginTop: 12, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
                  <strong>Customers:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {customers.length === 0 ? (
                      <li key="none">None</li>
                    ) : (
                      customers.map((c: any) => (
                        <li key={c.id}>{c.name}</li>
                      ))
                    )}
                  </ul>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card>
                <Statistic
                  title="Items Needing Attention"
                  value={kpis.itemsNeedRestock || 0}
                  prefix={<WarningOutlined />}
                />
                {kpis.itemsNeedRestock > 0 && (
                  <div style={{ marginTop: 4, color: '#ff4d4f', fontSize: 12 }}>
                    Low / zero stock items require purchase.
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 12, maxHeight: 180, overflowY: 'auto' }}>
                  <strong>Items:</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {(kpis.itemsNeedRestockNames && kpis.itemsNeedRestockNames.length > 0) ? (
                      kpis.itemsNeedRestockNames.map((name: string, i: number) => (
                        <li key={i}>{name}</li>
                      ))
                    ) : items.length === 0 ? (
                      <li key="none">None</li>
                    ) : (
                      items.slice(0, 50).map((it: any) => (
                        <li key={it.id}>{it.name}{it.quantity != null ? ` (qty: ${it.quantity})` : ''}</li>
                      ))
                    )}
                  </ul>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default Dashboard;
