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
        <div className="dashboard-filters">
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="YYYY-MM-DD"
          />
          <Radio.Group value={period} onChange={(e) => setPeriod(e.target.value)} style={{ marginLeft: 16 }}>
            <Radio.Button value="monthly">Monthly</Radio.Button>
            <Radio.Button value="yearly">Yearly</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Sales"
                  value={kpis.totalSales || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Purchases"
                  value={kpis.totalPurchases || 0}
                  prefix={<ShoppingCartOutlined />}
                  precision={2}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Expenses"
                  value={kpis.totalExpenses || 0}
                  prefix={<FileTextOutlined />}
                  precision={2}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Net Profit"
                  value={kpis.netProfit || 0}
                  prefix={<RiseOutlined />}
                  precision={2}
                  valueStyle={{ color: kpis.netProfit >= 0 ? '#3f8600' : '#cf1322' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Customers"
                  value={kpis.totalCustomers || 0}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Vendors"
                  value={kpis.totalVendors || 0}
                  prefix={<ShopOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Total Items"
                  value={kpis.totalItems ?? 0}
                  prefix={<InboxOutlined />}
                />
                {(kpis.itemsNeedRestock > 0 || kpis.itemsLowStock > 0) && (
                  <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
                    <WarningOutlined />
                    {kpis.itemsNeedRestock > 0 && (kpis.itemsNeedRestockNames?.length > 0) && (
                      <span> Need restock: {(kpis.itemsNeedRestockNames as string[]).slice(0, 5).join(', ')}{(kpis.itemsNeedRestockNames as string[]).length > 5 ? ` +${(kpis.itemsNeedRestockNames as string[]).length - 5} more` : ''}</span>
                    )}
                    {kpis.itemsNeedRestock > 0 && (!kpis.itemsNeedRestockNames || (kpis.itemsNeedRestockNames as string[]).length === 0) && (
                      <span> {kpis.itemsNeedRestock} item{kpis.itemsNeedRestock !== 1 ? 's' : ''} need restock</span>
                    )}
                    {kpis.itemsLowStock > 0 && kpis.itemsLowStock !== kpis.itemsNeedRestock && (kpis.itemsLowStockNames?.length > 0) && (
                      <div style={{ marginTop: 2 }}>
                        <span>Below 10 in stock: {(kpis.itemsLowStockNames as string[]).slice(0, 5).join(', ')}{(kpis.itemsLowStockNames as string[]).length > 5 ? ` +${(kpis.itemsLowStockNames as string[]).length - 5} more` : ''}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* Charts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card title="Sales vs Purchases" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareSalesVsPurchaseData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#8884d8" name="Sales" />
                    <Line type="monotone" dataKey="purchases" stroke="#82ca9d" name="Purchases" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Expense Breakdown" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {expenseBreakdown.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Monthly Revenue" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Top 5 Customers" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topCustomers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#82ca9d" name="Total Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default Dashboard;
