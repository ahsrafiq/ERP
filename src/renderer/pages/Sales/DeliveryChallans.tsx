import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, DatePicker, Select, InputNumber, message, notification, Popconfirm, Switch, Tag } from 'antd';
import { PlusOutlined, EditOutlined, PrinterOutlined, DeleteOutlined, FileTextOutlined, MinusCircleOutlined, MinusSquareOutlined, LockOutlined, StopOutlined, UndoOutlined, EyeOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { filterRowsByOperationalFiscalYear } from '../../utils/fiscalYearFilter';
import PrintTemplate from '../../components/PrintTemplate';
import XLSX from 'xlsx-js-style';
import logger from '../../utils/logger';

const DeliveryChallans: React.FC = () => {
    const { currentCompany, companies, user, fiscalYear, minimizeModal, globalRefreshKey, triggerGlobalRefresh, isPurchaseEnabled } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const docLabel = currentCompany?.is_gst_enabled ? 'Invoice' : 'Bill';
    const [challans, setChallans] = useState<any[]>([]);
    const challansRef = React.useRef<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [brands, setBrands] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingChallan, setEditingChallan] = useState<any>(null);
    const [defaultChallanNumber, setDefaultChallanNumber] = useState<string>('');
    const [form] = Form.useForm();
    const [printData, setPrintData] = useState<any>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [printWithLetterhead, setPrintWithLetterhead] = useState(true);
    const [pendingOnly, setPendingOnly] = useState(false);
    const [contentScale, setContentScale] = useState<number>(() => {
        const saved = localStorage.getItem('challan_scale');
        return saved ? parseFloat(saved) : 1;
    });

    useEffect(() => {
        localStorage.setItem('challan_scale', contentScale.toString());
    }, [contentScale]);
    // Admin password delete
    const [deletePasswordModal, setDeletePasswordModal] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
    const [adminPassword, setAdminPassword] = useState('');
    const passwordInputRef = React.useRef<any>(null);
    const lastPrintRecordRef = React.useRef<any>(null);

    useEffect(() => {
        if (deletePasswordModal) {
            setTimeout(() => {
                passwordInputRef.current?.select();
                passwordInputRef.current?.focus();
            }, 100);
        }
    }, [deletePasswordModal]);

    // Keep an always-fresh ref for Ctrl+P fallback selection.
    useEffect(() => {
        challansRef.current = challans;
    }, [challans]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                if (isPreviewVisible) {
                    actualPrint();
                    return;
                }
                const record = lastPrintRecordRef.current ?? challansRef.current?.[0];
                if (record) handlePrint(record);
                else message.warning('No delivery challans available to print.');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPreviewVisible]);

    // Section permissions (Sales)
    const isAdminUser = user?.role_id === 1 || user?.role === 'admin' || user?.username === 'admin';
    const sectionPerms = (user as any)?.section_permissions || {};
    const salesPerm: string = isAdminUser ? 'all' : (sectionPerms.sales || 'read');
    const canCreateOrEdit = isAdminUser || salesPerm === 'write' || salesPerm === 'edit' || salesPerm === 'all';
    const canEditOrDelete = isAdminUser || salesPerm === 'edit' || salesPerm === 'all';
    const isReadOnlySection = !isAdminUser && salesPerm === 'read';

    const watchedCustomerId = Form.useWatch('customer_id', form);
    const watchedItems = Form.useWatch('items', form);

    const totals = React.useMemo(() => {
        let qty = 0;
        let price = 0;
        if (watchedItems && Array.isArray(watchedItems)) {
            watchedItems.forEach((item: any) => {
                if (item) {
                    const q = Number(item.quantity) || 0;
                    const p = Number(item.unit_price) || 0;
                    qty += q;
                    price += q * p;
                }
            });
        }
        return { qty, price };
    }, [watchedItems]);

    // When customer is selected, load their terms and conditions
    useEffect(() => {
        if (!modalVisible) return;

        if (watchedCustomerId == null || watchedCustomerId === '') {
            form.setFieldsValue({ terms_and_conditions: [] });
            return;
        }

        const id = Number(watchedCustomerId);
        if (!id) return;

        const parseTerms = (raw: any): string[] => {
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'string') {
                try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch { /* legacy plain text */ }
                return raw.trim() ? [raw] : [];
            }
            return [];
        };

        const fromList = customers.find((c: any) => c.id === id);
        if (fromList && fromList.terms_and_conditions != null) {
            form.setFieldsValue({ terms_and_conditions: parseTerms(fromList.terms_and_conditions) });
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const result = await (window as any).electronAPI.db.customers.getById(id);
                if (cancelled) return;
                if (result?.success && result?.data) {
                    form.setFieldsValue({ terms_and_conditions: parseTerms(result.data.terms_and_conditions) });
                }
            } catch (_) { }
        })();
        return () => { cancelled = true; };
    }, [modalVisible, watchedCustomerId, form]);

    useEffect(() => {
        if (currentCompany) {
            // If we navigated to this page, reload the latest data
            if (location.pathname === '/sales/delivery-challans') {
                loadChallans();
                loadCustomers();
                loadItems();
                loadBrands();
            } else if (challans.length === 0) {
                // Initial background load
                loadChallans();
                loadCustomers();
                loadItems();
                loadBrands();
            }
        }
    }, [currentCompany, location.pathname, fiscalYear, globalRefreshKey]);

    useEffect(() => {
        if (location.state?.editChallanId && customers.length > 0 && items.length > 0) {
            handleEdit({ id: location.state.editChallanId });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, customers]);

    const loadChallans = async () => {
        if (!currentCompany) return;
        setLoading(true);
        try {
            const result = await (window as any).electronAPI.db.deliveryChallans.getAll(currentCompany.id);
            if (result.success) {
                setChallans(filterRowsByOperationalFiscalYear(result.data || [], fiscalYear));
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'Failed to load delivery challans', duration: 0 });
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.customers.getAll(currentCompany.id);
        if (result.success) setCustomers(result.data || []);
    };

    const loadItems = async () => {
        if (!currentCompany) return;
        const result = await (window as any).electronAPI.db.items.getAll(currentCompany.id);
        if (result.success) setItems(result.data || []);
    };

    const loadBrands = async () => {
        try {
            const result = await (window as any).electronAPI.db.brands.getAll();
            if (result?.success && Array.isArray(result.data)) setBrands(result.data || []);
            else setBrands([]);
        } catch (_) { setBrands([]); }
    };

    const handlePrint = async (record: any) => {
        logger.info(`Print request started for challan ID ${record.id}`);
        try {
            lastPrintRecordRef.current = record;
            const result = await (window as any).electronAPI.db.deliveryChallans.getById(record.id);
            if (result.success && result.data) {
                setPrintData(result.data);
                setIsPreviewVisible(true);
                logger.info(`Print preview opened for challan ID ${record.id}`);
            } else {
                logger.error(`Failed to load challan for print: ${result.error}`);
                notification.error({ message: 'Error', description: 'Failed to load challan for print', duration: 0 });
            }
        } catch (error) {
            logger.error(`Print preview error: ${error instanceof Error ? error.message : String(error)}`);
            notification.error({ message: 'Error', description: 'Failed to prepare print', duration: 0 });
        }
    };

    const actualPrint = () => {
        logger.info('Actual print triggered (challan)');
        // Apply capturing class to hide UI and render only print container
        const body = document.body;
        body.classList.add('capturing-pdf');
        // Force reflow to ensure styles are applied
        void body.offsetHeight;
        setTimeout(async () => {
            try {
                logger.info('Invoking IPC print...');
                // Use IPC print which returns a promise that resolves when dialog closes
                await (window as any).electronAPI.db.files.print();
                logger.info('IPC print completed successfully.');
            } catch (err) {
                logger.error(`IPC print failed, falling back to window.print(): ${err instanceof Error ? err.message : String(err)}`);
                console.error('IPC print failed, falling back to window.print():', err);
                window.print();
            } finally {
                // Clean up class after print
                body.classList.remove('capturing-pdf');
            }
        }, 300);
    };

    const handleSavePDF = async () => {
        try {
            const customerName = printData?.customer_name ? printData.customer_name.trim() : 'Customer';
            const billNumber = printData?.challan_number ? printData.challan_number.trim() : 'Challan';
            const cleanCustomer = customerName.replace(/[\\/:*?"<>|]/g, '_');
            const cleanBill = billNumber.replace(/[\\/:*?"<>|]/g, '_');
            const defaultName = `${cleanCustomer}_${cleanBill}.pdf`;
            // Step 1: show the save dialog BEFORE any visual change
            const pathResult = await (window as any).electronAPI.db.files.getSavePath(defaultName);
            if (!pathResult.success) return;

            // Step 2: apply capturing class (brief flash, dialog already gone)
            document.body.classList.add('capturing-pdf');
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
            const result = await (window as any).electronAPI.db.files.captureAndSave(pathResult.filePath);
            if (result.success) {
                message.success(`Saved to: ${result.filePath}`);
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to save PDF', duration: 0 });
            }
        } catch {
            notification.error({ message: 'Error', description: 'Failed to save PDF', duration: 0 });
        } finally {
            document.body.classList.remove('capturing-pdf');
        }
    };


    const handleNewChallan = async () => {
        setEditingChallan(null);
        form.resetFields();
        setModalVisible(true);

        if (currentCompany) {
            try {
                const res = await (window as any).electronAPI.db.deliveryChallans.getNextNumber(currentCompany.id, fiscalYear);
                if (res.success) {
                    setDefaultChallanNumber(res.data);
                    form.setFieldsValue({
                        challan_number: res.data,
                        challan_date: dayjs(),
                    });
                } else {
                    form.setFieldsValue({ challan_date: dayjs() });
                }
            } catch (err) {
                console.error('Failed to load next DC number:', err);
                form.setFieldsValue({ challan_date: dayjs() });
            }
        }
    };

    const handleEdit = async (record: any) => {
        const result = await (window as any).electronAPI.db.deliveryChallans.getById(record.id);
        if (result.success) {
            setEditingChallan(result.data);
            let terms: string[] = [];
            const raw = result.data.terms_and_conditions;
            if (raw) { try { const arr = JSON.parse(raw); terms = Array.isArray(arr) ? arr : [raw]; } catch { terms = [raw]; } }
            const itemsWithBrandId = (result.data.items || []).map((row: any) => {
                const master = items.find((i: any) => i.id === row.item_id);
                return { ...row, brand_id: master?.brand_id ?? row.brand_id, deduct_stock: row.deduct_stock === 1 ? 1 : 0 };
            });
            form.setFieldsValue({
                ...result.data,
                items: itemsWithBrandId,
                challan_date: dayjs(result.data.challan_date),
                terms_and_conditions: terms,
                po_number: result.data.po_number ?? '',
            });
            setModalVisible(true);
        } else {
            notification.error({ message: 'Error', description: 'Failed to fetch challan details', duration: 0 });
        }
    };

    const handleCreateInvoice = async (record: any) => {
        const alreadyHasInvoice = record.sales_invoice_id != null && record.sales_invoice_id !== '';
        if (alreadyHasInvoice) {
            Modal.confirm({
                title: `Duplicate ${docLabel.toLowerCase()}`,
                content: `This delivery challan already has a ${docLabel.toLowerCase()}. You are creating another ${docLabel.toLowerCase()} (a duplicate). Do you want to continue?`,
                okText: 'Yes, create duplicate',
                cancelText: 'Cancel',
                onOk: () => doCreateInvoiceFromChallan(record.id),
            });
        } else {
            Modal.confirm({
                title: `Create ${docLabel}`,
                content: `Are you sure you want to create a ${docLabel.toLowerCase()} from this Delivery Challan?`,
                okText: 'Yes, Create',
                cancelText: 'Cancel',
                onOk: () => doCreateInvoiceFromChallan(record.id),
            });
        }
    };

    const doCreateInvoiceFromChallan = async (challanId: number, force: boolean = false) => {
        try {
            // Ensure all data is plain and serializable for IPC
            const plainChallanId = JSON.parse(JSON.stringify(challanId));
            const plainUserId = user?.id ? JSON.parse(JSON.stringify(user.id)) : undefined;
            const plainFy = fiscalYear ? JSON.parse(JSON.stringify(fiscalYear)) : undefined;
            const plainForce = Boolean(force);

            const result = await (window as any).electronAPI.db.salesInvoices.createFromChallan(
                plainChallanId,
                plainUserId,
                plainFy,
                plainForce
            );
            if (result.success && result.data) {
                message.success(`${docLabel} ${result.data.invoice_number} created from challan`);
                navigate('/sales/invoices');
            } else if (result.error === 'ALREADY_EXISTS') {
                Modal.confirm({
                    title: 'Invoice already exists',
                    content: `An invoice (${result.existingNumber}) has already been created for this delivery challan by another user. Do you still want to create another one?`,
                    okText: 'Yes, create duplicate',
                    cancelText: 'Cancel',
                    onOk: () => doCreateInvoiceFromChallan(challanId, true),
                });
            } else {
                notification.error({ message: 'Error', description: result.error || `Failed to create ${docLabel.toLowerCase()}`, duration: 0 });
                if (result.code === 'CONFLICT' || (result.error && result.error.includes('already created'))) {
                    loadChallans();
                }
            }
        } catch (error: any) {
            notification.error({ message: 'Error', description: error.message || `Failed to create ${docLabel.toLowerCase()}`, duration: 0 });
            if (error.message && error.message.includes('already created')) {
                loadChallans();
            }
        }
    };

    const handleRequestDelete = (id: number) => {
        setPendingDeleteId(id);
        setAdminPassword('');
        setDeletePasswordModal(true);
    };

    const handleConfirmDelete = async () => {
        const verify = await (window as any).electronAPI.db.auth.verifyAdminPassword(adminPassword);
        if (!verify.success || !verify.data) {
            notification.error({ message: 'Error', description: 'Incorrect admin password', duration: 0 });
            setAdminPassword('');
            return;
        }
        if (pendingDeleteId == null) return;
        try {
            const result = await (window as any).electronAPI.db.deliveryChallans.delete(pendingDeleteId);
            if (result.success) {
                message.success('Delivery Challan deleted successfully');
                loadChallans();
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to delete challan', duration: 0 });
            }
        } catch (error: any) {
            const msg = error?.message || 'Failed to delete challan';
            notification.error({ message: 'Error', description: msg, duration: 0 });
        } finally {
            setDeletePasswordModal(false);
            setPendingDeleteId(null);
            setAdminPassword('');
        }
    };

    const handleDisable = async (id: number) => {
        try {
            const fetched = await (window as any).electronAPI.db.deliveryChallans.getById(id);
            if (!fetched.success || !fetched.data) {
                notification.error({ message: 'Error', description: 'Failed to load challans', duration: 0 });
                return;
            }
            const data = fetched.data;
            const result = await (window as any).electronAPI.db.deliveryChallans.update(id, {
                ...data,
                status: 'cancelled',
            });
            if (result.success) {
                message.success('Delivery Challan disabled');
                loadChallans();
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to disable challan', duration: 0 });
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'Failed to disable challan', duration: 0 });
        }
    };

    const handleEnable = async (id: number) => {
        try {
            const fetched = await (window as any).electronAPI.db.deliveryChallans.getById(id);
            if (!fetched.success || !fetched.data) {
                notification.error({ message: 'Error', description: 'Failed to load challan', duration: 0 });
                return;
            }
            const data = fetched.data;
            const result = await (window as any).electronAPI.db.deliveryChallans.update(id, {
                ...data,
                status: 'confirmed',
            });
            if (result.success) {
                message.success('Delivery Challan re-enabled');
                loadChallans();
            } else {
                notification.error({ message: 'Error', description: result.error || 'Failed to re-enable challan', duration: 0 });
            }
        } catch (error) {
            notification.error({ message: 'Error', description: 'Failed to re-enable challan', duration: 0 });
        }
    };

    const handleSave = async (values: any) => {
        if (!currentCompany) return;

        // Build the challan data first (without deduct_stock yet)
        const buildChallanData = (values: any) => {
            const challanData: any = {
                ...values,
                company_id: currentCompany.id,
                challan_number: values.challan_number?.trim?.() || undefined,
                po_number: values.po_number || null,
                fiscal_year: fiscalYear,
                challan_date: values.challan_date.format('YYYY-MM-DD'),
                created_by: user?.id,
                terms_and_conditions: JSON.stringify((values.terms_and_conditions || []).filter((t: string) => t?.trim())),
                isDefaultNumber: !editingChallan && values.challan_number === defaultChallanNumber,
            };
            // Ensure each item has brand (text) for backend; total quantity
            let totalQty = 0;
            challanData.items = (challanData.items || []).map((item: any) => {
                totalQty += item.quantity ?? 0;
                const brandName = (item.brand_id != null && item.brand_id !== '')
                    ? (brands.find((b: any) => Number(b.id) === Number(item.brand_id))?.name)
                    : null;
                const fallbackBrand = items.find((i: any) => i.id === item.item_id)?.brand_name;
                return { ...item, brand: brandName ?? fallbackBrand ?? item.brand };
            });
            challanData.total_quantity = totalQty;
            return challanData;
        };

        const doSave = async () => {
            try {
                const challanData = buildChallanData(values);
                if (editingChallan) {
                    const result = await (window as any).electronAPI.db.deliveryChallans.update(editingChallan.id, challanData);
                    if (result.success) {
                        message.success('Delivery Challan updated successfully');
                        setModalVisible(false);
                        setEditingChallan(null);
                        loadChallans();
                    } else {
                        notification.error({ message: 'Error', description: result.error || 'Failed to update delivery challan', duration: 0 });
                    }
                } else {
                    const result = await (window as any).electronAPI.db.deliveryChallans.create(challanData);
                    if (result.success) {
                        message.success(`Delivery Challan ${result.data?.challan_number || ''} created successfully`);
                        setModalVisible(false);
                        setEditingChallan(null);
                        loadChallans();
                        triggerGlobalRefresh();
                    } else {
                        notification.error({ message: 'Error', description: result.error || 'Failed to create challan', duration: 0 });
                    }
                }
            } catch (error: any) {
                console.error('Save error:', error);
                notification.error({ message: 'Error', description: error.message || 'Operation failed', duration: 0 });
            }
        };

        await doSave();
    };

    const columns = [
        { title: 'Challan #', dataIndex: 'challan_number', key: 'challan_number' },
        { title: 'PO #', dataIndex: 'po_number', key: 'po_number' },
        { title: 'Customer', dataIndex: 'customer_name', key: 'customer' },
        { title: 'Date', dataIndex: 'challan_date', key: 'date', render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
        { title: 'Total Qty', dataIndex: 'total_quantity', key: 'qty' },
        {
            title: `${docLabel} Made`,
            key: 'invoice_made',
            render: (_: any, record: any) => {
                const hasInvoice = record.sales_invoice_id != null && record.sales_invoice_id !== '';
                return hasInvoice ? <Tag color="green">Yes</Tag> : <Tag color="default">No</Tag>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => {
                if (record.status === 'cancelled') {
                    if (isAdminUser) {
                        return (
                            <Space>
                                <Tag color="red">Disabled</Tag>
                                <Popconfirm title="Re-enable this delivery challan?" onConfirm={() => handleEnable(record.id)} okText="Yes, Re-enable" cancelText="Cancel">
                                    <Button icon={<UndoOutlined />} title="Re-enable (Admin)" style={{ color: '#52c41a', borderColor: '#52c41a' }} />
                                </Popconfirm>
                            </Space>
                        );
                    }
                    return <Tag color="red">Disabled</Tag>;
                }
                if (isReadOnlySection) {
                    return (
                        <Space>
                            <Button icon={<EyeOutlined />} onClick={() => handlePrint(record)} title="View Challan" />
                        </Space>
                    );
                }
                return (
                    <Space>
                        {!isReadOnlySection && (
                            <Button icon={<FileTextOutlined />} onClick={() => handleCreateInvoice(record)} title={`Create ${docLabel}`} />
                        )}
                        <Button icon={<PrinterOutlined />} onClick={() => handlePrint(record)} title="Print" />
                        {canCreateOrEdit && (
                            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} title="Edit" />
                        )}
                        {canEditOrDelete && (
                            <>
                                <Popconfirm title="Are you sure you want to disable this delivery challan? This cannot be undone." onConfirm={() => handleDisable(record.id)} okText="Yes, Disable" cancelText="Cancel">
                                    <Button icon={<StopOutlined />} title="Disable" />
                                </Popconfirm>
                                <Button danger icon={<DeleteOutlined />} title="Delete" onClick={() => handleRequestDelete(record.id)} />
                            </>
                        )}
                    </Space>
                );
            },
        },
    ];

    const [searchQuery, setSearchQuery] = useState('');

    const filteredChallans = challans.filter(c => {
        const matchesSearch = (c.challan_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase());
        const hasInvoice = c.sales_invoice_id != null && c.sales_invoice_id !== '';
        const matchesPending = !pendingOnly || !hasInvoice;
        return matchesSearch && matchesPending;
    });

    const handleExportExcelSingle = () => {
        if (!printData) return;
        
        const company = (companies || []).find((c: any) => c.id === printData.company_id) || currentCompany;

        const wb = XLSX.utils.book_new();

        // Define styles
        const titleStyle = { font: { bold: true, size: 16 } };
        const labelStyle = { font: { bold: true } };
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "333333" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" }
            }
        };
        const itemStyle = {
            alignment: { vertical: "center" },
            border: {
                top: { style: "thin" }, bottom: { style: "thin" },
                left: { style: "thin" }, right: { style: "thin" }
            }
        };
        const numberStyle = { ...itemStyle, alignment: { horizontal: "right", vertical: "center" } };

        const wsData: any[][] = [
            [{ v: 'DELIVERY CHALLAN', s: titleStyle }],
            [],
            [{ v: 'Company:', s: labelStyle }, company?.name || ''],
            [{ v: 'Date:', s: labelStyle }, dayjs(printData.challan_date).format('DD/MM/YYYY')],
            [{ v: 'Challan #:', s: labelStyle }, printData.challan_number],
            [{ v: 'PO #:', s: labelStyle }, printData.po_number || ''],
            [{ v: 'Customer:', s: labelStyle }, printData.customer_name || ''],
            [],
            [
                { v: 'S.No', s: headerStyle },
                { v: 'Brand', s: headerStyle },
                { v: 'Item', s: headerStyle },
                { v: 'Description', s: headerStyle },
                { v: 'Qty', s: headerStyle }
            ]
        ];

        // Add items
        let totalQty = 0;
        (printData.items || []).forEach((it: any, index: number) => {
            const qty = Number(it.quantity || 0);
            totalQty += qty;
            wsData.push([
                { v: index + 1, s: itemStyle },
                { v: it.brand || '', s: itemStyle },
                { v: it.item_name || '', s: itemStyle },
                { v: it.description || '', s: itemStyle },
                { v: qty, s: numberStyle }
            ]);
        });

        // Add footer for total quantity
        const footerStyle = { font: { bold: true }, alignment: { horizontal: "right" } };
        wsData.push([]);
        wsData.push([
            '', '', '', 
            { v: 'Total Quantity:', s: footerStyle }, 
            { v: totalQty, s: { ...footerStyle, alignment: { horizontal: "right" } } }
        ]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Set column widths
        ws['!cols'] = [
            { wch: 6 },  // S.No
            { wch: 15 }, // Brand
            { wch: 25 }, // Item
            { wch: 45 }, // Description
            { wch: 10 }  // Qty
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Delivery Challan');
        XLSX.writeFile(wb, `${printData.challan_number}.xlsx`);
        message.success('Exported to Excel');
    };

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <h1 style={{ margin: 0 }}>Delivery Challans</h1>
                    <Input
                        placeholder="Search by challan # or customer..."
                        prefix={<SearchOutlined />}
                        style={{ width: 250 }}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        allowClear
                    />
                    <Space style={{ background: '#f5f5f5', padding: '4px 12px', borderRadius: 6, border: '1px solid #d9d9d9' }}>
                        <span style={{ fontSize: 13, color: '#595959', fontWeight: 500 }}>
                            Pending {docLabel}s Only
                        </span>
                        <Switch
                            checked={pendingOnly}
                            onChange={(checked) => setPendingOnly(checked)}
                            size="small"
                        />
                    </Space>
                </div>
                <Space>
                    {!isReadOnlySection && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleNewChallan}>
                            New Challan
                        </Button>
                    )}
                </Space>
            </div>

            <Table columns={columns} dataSource={filteredChallans} loading={loading} rowKey="id" />

            <Modal 
                title={editingChallan ? 'Edit Delivery Challan' : 'New Delivery Challan'} 
                open={modalVisible} 
                onCancel={() => {
                  setModalVisible(false);
                  setEditingChallan(null);
                  form.resetFields();
                }}
                maskClosable={true} 
                onOk={() => form.submit()} 
                width={900} 
                closeIcon={
                  <Space size="middle">
                    <MinusSquareOutlined 
                      style={{ fontSize: 18, color: '#1890ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const dcNum = form.getFieldValue('challan_number') || 'New DC';
                        setModalVisible(false);
                        minimizeModal({
                          id: editingChallan ? `dc-edit-${editingChallan.id}` : 'dc-new',
                          title: editingChallan ? `Edit DC ${dcNum}` : `New DC ${dcNum}`,
                          onRestore: () => {
                            setEditingChallan(editingChallan);
                            setModalVisible(true);
                          }
                        });
                      }}
                    />
                    <CloseOutlined style={{ fontSize: 18 }} onClick={(e) => {
                      e.stopPropagation();
                      setModalVisible(false);
                      setEditingChallan(null);
                      form.resetFields();
                    }} />
                  </Space>
                }
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Space align="start" wrap>
                        <Form.Item name="challan_number" label="Challan #" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 16 }}>
                            <Input placeholder="e.g. DC-0001/26" style={{ width: 160 }} />
                        </Form.Item>
                        <Form.Item name="po_number" label="PO #" style={{ marginBottom: 16 }}>
                            <Input placeholder="PO Number" style={{ width: 160 }} />
                        </Form.Item>
                    </Space>
                    <Space align="start" wrap>
                        <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]} style={{ width: 300 }}>
                             <Select 
                                showSearch 
                                filterOption={(input, option) =>
                                    String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                            >
                                {customers.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="challan_date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
                            <DatePicker />
                        </Form.Item>
                    </Space>

                    <Form.List
                        name="items"
                        rules={[
                            {
                                validator: async (_, names) => {
                                    if (!names || names.length < 1) {
                                        return Promise.reject(new Error('At least one item is required'));
                                    }
                                    const itemsData = form.getFieldValue('items') || [];
                                    const itemIds = itemsData.map((item: any) => item?.item_id).filter(Boolean);
                                },
                            },
                        ]}
                    >
                        {(fields, { add, remove }, { errors }) => (
                            <>
                                {fields.map(({ key, name, ...restField }) => {
                                    const rowBrandId = form.getFieldValue(['items', name, 'brand_id']);
                                    const itemsForBrand = (rowBrandId != null && rowBrandId !== '')
                                        ? items.filter((i: any) => Number(i.brand_id) === Number(rowBrandId))
                                        : items;
                                    return (
                                    <div key={key} style={{ borderBottom: '1px solid #f0f0f0', marginBottom: 16, paddingBottom: 16 }}>
                                        <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>
                                            <Form.Item {...restField} name={[name, 'brand_id']} label="Brand" rules={[{ required: true, message: 'Select brand' }]} style={{ marginBottom: 0, minWidth: 140 }}>
                                                <Select
                                                    placeholder="Brand"
                                                    style={{ width: 140 }}
                                                    showSearch
                                                    optionFilterProp="children"
                                                    onChange={(selectedBrandId) => {
                                                        const currentItems = form.getFieldValue('items') || [];
                                                        currentItems[name] = { ...currentItems[name], brand_id: selectedBrandId, item_id: undefined, description: '', unit_price: 0 };
                                                        form.setFieldsValue({ items: currentItems });
                                                    }}
                                                >
                                                    {(brands || []).map((b: any) => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'item_id']} label="Item" rules={[{ required: true, message: 'Select item' }]} style={{ marginBottom: 0, minWidth: 200 }}>
                                                <Select
                                                    placeholder="Item"
                                                    style={{ width: 200 }}
                                                    showSearch
                                                    filterOption={(input, option) =>
                                                        String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                                    }
                                                    onChange={(itemId) => {
                                                        const item = items.find((i: any) => i.id === itemId);
                                                        if (item) {
                                                            const currentItems = form.getFieldValue('items') || [];
                                                            currentItems[name] = {
                                                                ...currentItems[name],
                                                                description: item.description || '',
                                                                brand_id: item.brand_id,
                                                                unit_price: item.selling_price ?? 0
                                                            };
                                                            form.setFieldsValue({ items: currentItems });
                                                        }
                                                    }}
                                                >
                                                    {itemsForBrand.map((i: any) => <Select.Option key={i.id} value={i.id}>{i.name} ({i.code})</Select.Option>)}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item {...restField} name={[name, 'quantity']} label="Qty" rules={[{ required: true, message: 'Qty' }]} style={{ marginBottom: 0, width: 80, flexShrink: 0 }}>
                                                <InputNumber placeholder="Qty" min={0} style={{ width: 80 }} />
                                            </Form.Item>
                                             <Form.Item {...restField} name={[name, 'unit_price']} label="Price" initialValue={0} style={{ marginBottom: 0, width: 100, flexShrink: 0 }}>
                                                <InputNumber placeholder="Price" min={0} style={{ width: 100 }} />
                                            </Form.Item>
                                            {isPurchaseEnabled && (() => {
                                                const currentItem = watchedItems?.[name];
                                                const stockItem = items.find((i: any) => i.id === currentItem?.item_id);
                                                const currentStock = Number(stockItem?.quantity) || 0;
                                                const inputtedQty = Number(currentItem?.quantity) || 0;
                                                const availableStock = currentStock - inputtedQty;
                                                return (
                                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                                        <Form.Item {...restField} name={[name, 'deduct_stock']} label="Remove Stock" initialValue={0} style={{ marginBottom: 0, width: 120, flexShrink: 0 }}>
                                                            <Select>
                                                                <Select.Option value={1}>Yes</Select.Option>
                                                                <Select.Option value={0}>No</Select.Option>
                                                            </Select>
                                                        </Form.Item>
                                                        {currentItem?.item_id && currentItem?.deduct_stock !== 0 && (
                                                            <div style={{ paddingBottom: 6, fontSize: 13, color: availableStock < 0 ? '#cf1322' : '#52c41a', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                                                Stock: {availableStock} {stockItem?.location ? `(${stockItem.location})` : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} style={{ flexShrink: 0 }} />
                                        </div>
                                        <Form.Item {...restField} name={[name, 'description']} style={{ marginBottom: 0 }}>
                                            <Input.TextArea placeholder="Item Description" autoSize={{ minRows: 1, maxRows: 3 }} />
                                        </Form.Item>
                                    </div>
                                    );
                                })}
                                {fields.length > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: '24px',
                                        marginTop: '12px',
                                        marginBottom: '16px',
                                        padding: '12px 16px',
                                        background: '#fafafa',
                                        borderRadius: '8px',
                                        border: '1px solid #f0f0f0'
                                    }}>
                                        <div>
                                            <span style={{ color: '#8c8c8c', marginRight: '8px' }}>Total Qty:</span>
                                            <strong style={{ fontSize: '15px', color: '#1f1f1f' }}>{totals.qty}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#8c8c8c', marginRight: '8px' }}>Total Price:</span>
                                            <strong style={{ fontSize: '15px', color: '#1f1f1f' }}>{totals.price.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                )}
                                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Add Item</Button>
                                <div style={{ color: '#ff4d4f', marginTop: 8 }}>
                                    <Form.ErrorList errors={errors} />
                                </div>
                            </>
                        )}
                    </Form.List>

                    <div style={{ marginTop: 20 }}>
                        <label style={{ fontWeight: 500 }}>Terms and Conditions</label>
                        <Form.List name="terms_and_conditions">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.map((field) => (
                                        <div key={field.key} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                            <Form.Item {...field} style={{ flex: 1, marginBottom: 0 }}>
                                                <Input placeholder={`Term ${field.name + 1}`} />
                                            </Form.Item>
                                            <MinusCircleOutlined onClick={() => remove(field.name)} style={{ marginTop: 8, color: '#ff4d4f' }} />
                                        </div>
                                    ))}
                                    <Button type="dashed" onClick={() => add('')} block icon={<PlusOutlined />} size="small">Add Term</Button>
                                </>
                            )}
                        </Form.List>
                    </div>
                </Form>
            </Modal>

            <Modal
                title="Print Preview"
                open={isPreviewVisible}
                onCancel={() => {
                    setIsPreviewVisible(false);
                    setPrintData(null);
                }}
                width={900}
                maskClosable={true}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {currentCompany?.letterhead_path && (
                                <Switch
                                    checked={printWithLetterhead}
                                    onChange={setPrintWithLetterhead}
                                    checkedChildren="With Letterhead"
                                    unCheckedChildren="Without Letterhead"
                                />
                            )}
                            <span>Scale:</span>
                            <Select value={contentScale} onChange={v => setContentScale(v)} style={{ width: 90 }} options={[{ value: 0.5, label: '50%' }, { value: 0.6, label: '60%' }, { value: 0.7, label: '70%' }, { value: 0.8, label: '80%' }, { value: 0.9, label: '90%' }, { value: 1, label: '100%' }]} />
                        </div>
                        <Space>
                            <Button onClick={() => { setIsPreviewVisible(false); setPrintData(null); }}>Close</Button>
                            <Button key="excel" onClick={handleExportExcelSingle}>Export to Excel</Button>
                            <Button icon={<PrinterOutlined />} onClick={handleSavePDF}>Save as PDF</Button>
                            <Button type="primary" onClick={actualPrint}>Print</Button>
                        </Space>
                    </div>
                }
                className="print-preview-modal"
                closeIcon={
                  <Space>
                    <MinusSquareOutlined
                      style={{ fontSize: 18, color: '#1890ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const preview = printData;
                        const restoreLetterhead = printWithLetterhead;
                        const restoreScale = contentScale;
                        setIsPreviewVisible(false);
                        setPrintData(null);
                        minimizeModal({
                          id: preview?.id != null ? `print-dc-${preview.id}` : 'print-dc',
                          title: preview?.challan_number ? `Print DC ${preview.challan_number}` : 'Print DC',
                          returnPath: location.pathname,
                          onRestore: () => {
                            setPrintWithLetterhead(restoreLetterhead);
                            setContentScale(restoreScale);
                            setPrintData(preview);
                            setIsPreviewVisible(true);
                          },
                        });
                      }}
                    />
                    <CloseOutlined
                      style={{ fontSize: 18 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPreviewVisible(false);
                        setPrintData(null);
                      }}
                    />
                  </Space>
                }
            >
                <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px', background: '#f5f5f5' }}>
                    <div className="preview-page-wrapper">
                        {printData && (
                            <PrintTemplate
                                type="challan"
                                data={printData}
                                company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                                withLetterhead={printWithLetterhead}
                                contentScale={contentScale}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            {/* Hidden print container — revealed by @media print CSS for PDF/Print capture */}
            <div id="print-container">
                {printData && (
                    <PrintTemplate
                        type="challan"
                        data={printData}
                        company={(companies || []).find((c: any) => c.id === printData.company_id) || currentCompany}
                        withLetterhead={printWithLetterhead}
                        contentScale={contentScale}
                    />
                )}
            </div>

            <Modal
                title="Admin password required"
                open={deletePasswordModal}
                onCancel={() => {
                    setDeletePasswordModal(false);
                    setPendingDeleteId(null);
                    setAdminPassword('');
                }}
                onOk={handleConfirmDelete}
                okText="Delete"
                okButtonProps={{ danger: true }}
            >
                <p>Enter admin password to delete this delivery challan:</p>
                <Input.Password
                    prefix={<LockOutlined />}
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="Admin password"
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmDelete(); }}
                    ref={passwordInputRef}
                    autoFocus
                />
            </Modal>

        </div >
    );
};

export default DeliveryChallans;
