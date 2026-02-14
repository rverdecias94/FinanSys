
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Helper to format currency numbers
 */
const fmt = (num) => num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Analyzes transactions to generate a structured finance report
 */
export const generateFinanceReport = (transactions, dateFilter) => {
  const reportDate = format(new Date(), 'dd/MM/yyyy');
  const periodLabel = dateFilter?.label || 'Periodo no especificado';

  // 1. Data Processing
  const currencies = [...new Set(transactions.map(t => t.currency || 'CUP'))];
  const dataByCurrency = {};

  currencies.forEach(curr => {
    const txs = transactions.filter(t => (t.currency || 'CUP') === curr);
    const income = txs.filter(t => t.type === 'income');
    const expense = txs.filter(t => t.type === 'expense');
    
    dataByCurrency[curr] = {
      incomeTotal: income.reduce((sum, t) => sum + Number(t.amount), 0),
      expenseTotal: expense.reduce((sum, t) => sum + Number(t.amount), 0),
      incomeCount: income.length,
      expenseCount: expense.length,
      incomeTxs: income,
      expenseTxs: expense
    };
    dataByCurrency[curr].net = dataByCurrency[curr].incomeTotal - dataByCurrency[curr].expenseTotal;
  });

  // 2. Metadata
  const metadata = [
    { label: "Período", value: periodLabel },
    { label: "Fecha de emisión", value: reportDate },
    { label: "Monedas de referencia", value: currencies.join(' / ') },
    { label: "Estatus del reporte", value: "Parcial – Corte investigativo" }
  ];

  const sections = [];

  // 3. Section 1: Executive Summary
  const totalTx = transactions.length;
  const hasUSD = currencies.includes('USD');
  const mainCurrency = currencies[0] || 'CUP';
  
  let summaryText = `Durante el periodo analizado, se registraron un total de ${totalTx} operaciones. `;
  if (dataByCurrency[mainCurrency]) {
    const net = dataByCurrency[mainCurrency].net;
    summaryText += `En moneda principal (${mainCurrency}), se observa ${net >= 0 ? 'un superávit' : 'un déficit'} operativo de ${fmt(Math.abs(net))}. `;
  }
  if (hasUSD) {
    summaryText += `Se evidencia actividad en divisa extranjera (USD) que requiere atención para su correcta valoración y liquidación. `;
  }
  summaryText += "El flujo de caja muestra una dinámica mixta con predominio de operaciones corrientes.";

  sections.push({
    title: "1. Resumen General de Operaciones",
    content: summaryText
  });

  // 4. Section 2: Statement of Results (Table)
  const resultHeaders = ["Concepto", ...currencies.map(c => `Importe (${c})`)];
  const resultRows = [
    ["Ingresos totales", ...currencies.map(c => fmt(dataByCurrency[c]?.incomeTotal || 0))],
    ["Gastos totales", ...currencies.map(c => fmt(dataByCurrency[c]?.expenseTotal || 0))],
    ["Resultado neto", ...currencies.map(c => fmt(dataByCurrency[c]?.net || 0))]
  ];

  sections.push({
    title: "2. Estado de Resultados Parcial",
    type: "table",
    headers: resultHeaders,
    rows: resultRows,
    notes: `Resultado consolidado: Se observa un comportamiento financiero diferenciado por moneda. Se recomienda consolidar saldos para un análisis integral.`
  });

  // 5. Section 3: Income Analysis
  // Group incomes by category
  const incomeAnalysis = [];
  currencies.forEach(curr => {
    if (dataByCurrency[curr]?.incomeTotal > 0) {
      const cats = {};
      dataByCurrency[curr].incomeTxs.forEach(t => {
        cats[t.category] = (cats[t.category] || 0) + Number(t.amount);
      });
      const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
      incomeAnalysis.push(`- **Ingresos en ${curr}:** Total de ${fmt(dataByCurrency[curr].incomeTotal)}. Principal fuente: ${topCat[0]} (${fmt(topCat[1])}).`);
    }
  });

  if (incomeAnalysis.length === 0) incomeAnalysis.push("No se registraron ingresos en el periodo.");

  sections.push({
    title: "3. Análisis de Ingresos",
    type: "list",
    items: incomeAnalysis,
    notes: hasUSD ? "Observación: Los ingresos en divisa representan activos financieros líquidos disponibles." : ""
  });

  // 6. Section 4: Expense Analysis (Table)
  // Top 5 expenses
  const topExpenses = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map(t => [
      t.category || 'Sin categoría',
      `${fmt(Number(t.amount))} ${t.currency}`,
      t.details?.payment_method || 'Efectivo',
      t.description || '-'
    ]);

  if (topExpenses.length > 0) {
    sections.push({
      title: "4. Detalle de Gastos Principales",
      type: "table",
      headers: ["Categoría", "Monto", "Método", "Observaciones"],
      rows: topExpenses
    });
  }

  // 7. KPIs
  const kpis = [];
  currencies.forEach(curr => {
    const d = dataByCurrency[curr];
    if (d && (d.incomeTotal > 0 || d.expenseTotal > 0)) {
      const ratio = d.incomeTotal > 0 ? (d.expenseTotal / d.incomeTotal).toFixed(2) : "N/A";
      kpis.push([`Relación Gasto/Ingreso (${curr})`, `${ratio} : 1`]);
      
      const cashExpenses = d.expenseTxs.filter(t => !t.details?.payment_method || t.details.payment_method === 'cash').reduce((s, t) => s + Number(t.amount), 0);
      const cashPct = d.expenseTotal > 0 ? ((cashExpenses / d.expenseTotal) * 100).toFixed(0) : 0;
      kpis.push([`% Gastos en Efectivo (${curr})`, `${cashPct}% (${fmt(cashExpenses)} de ${fmt(d.expenseTotal)})`]);
    }
  });

  sections.push({
    title: "5. Indicadores de Gestión Financiera",
    type: "table",
    headers: ["Indicador", "Valor"],
    rows: kpis
  });

  // 8. Conclusions
  const conclusions = [
    `1. Situación Financiera: El periodo cierra con un balance neto ${dataByCurrency[mainCurrency]?.net >= 0 ? 'positivo' : 'negativo'} en la moneda principal.`,
    `2. Gestión de Gastos: Se recomienda monitorear las categorías con mayor incidencia en el presupuesto.`,
    `3. Política de Pagos: ${kpis.some(k => k[1].includes('100%')) ? 'Alta dependencia del efectivo.' : 'Diversificación adecuada de medios de pago.'}`
  ];

  sections.push({
    title: "6. Conclusiones y Recomendaciones",
    type: "list",
    items: conclusions
  });

  return {
    title: `Informe de Análisis Financiero`,
    metadata,
    sections
  };
};

/**
 * Analyzes movements to generate a structured warehouse report
 */
export const generateWarehouseReport = (movements, dateFilter) => {
  const reportDate = format(new Date(), 'dd/MM/yyyy');
  const sections = [];

  // Metadata
  const metadata = [
    { label: "Período", value: dateFilter?.label },
    { label: "Fecha de emisión", value: reportDate },
    { label: "Total Movimientos", value: movements.length.toString() }
  ];

  // Section 1: Summary
  const ins = movements.filter(m => m.type === 'in');
  const outs = movements.filter(m => m.type === 'out');
  
  sections.push({
    title: "1. Resumen Operativo de Almacén",
    content: `Durante el periodo se registraron ${movements.length} movimientos de inventario. El flujo operativo muestra ${ins.length} entradas de abastecimiento y ${outs.length} salidas por consumo o venta.`
  });

  // Section 2: Product Flow Table
  const products = {};
  movements.forEach(m => {
    const name = m.products?.name || 'Desconocido';
    if (!products[name]) products[name] = { in: 0, out: 0 };
    products[name][m.type] += m.qty;
  });

  const productRows = Object.entries(products)
    .sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out))
    .slice(0, 10)
    .map(([name, counts]) => [name, counts.in.toString(), counts.out.toString(), (counts.in - counts.out).toString()]);

  sections.push({
    title: "2. Flujo de Productos (Top 10)",
    type: "table",
    headers: ["Producto", "Entradas", "Salidas", "Balance Periodo"],
    rows: productRows
  });

  // Section 3: Conclusions
  const conclusions = [
    ins.length > outs.length ? "Tendencia a la acumulación de stock (más entradas que salidas)." : "Tendencia a la reducción de inventario (más salidas que entradas).",
    `El producto con mayor movimiento fue "${productRows[0]?.[0] || 'N/A'}".`
  ];

  sections.push({
    title: "3. Conclusiones de Almacén",
    type: "list",
    items: conclusions
  });

  return {
    title: "Informe de Gestión de Almacén",
    metadata,
    sections
  };
};

/**
 * Analyzes inventory to generate a structured inventory report
 */
export const generateInventoryReport = (inventorySummary, dateFilter) => {
  const reportDate = format(new Date(), 'dd/MM/yyyy');
  const sections = [];

  const totalItems = inventorySummary.reduce((sum, area) => sum + (area.itemsCount || 0), 0);

  // Metadata
  const metadata = [
    { label: "Período", value: dateFilter?.label },
    { label: "Fecha de emisión", value: reportDate },
    { label: "Total Activos/Items", value: totalItems.toString() }
  ];

  // Section 1: Summary
  sections.push({
    title: "1. Estado del Inventario por Áreas",
    content: `El inventario actual se distribuye en ${inventorySummary.length} áreas operativas, con un total de ${totalItems} ítems registrados en el sistema durante este periodo.`
  });

  // Section 2: Area Breakdown Table
  const areaRows = inventorySummary
    .sort((a, b) => (b.itemsCount || 0) - (a.itemsCount || 0))
    .map(area => [area.name, area.itemsCount?.toString() || "0", area.icon || "-"]);

  sections.push({
    title: "2. Desglose por Área",
    type: "table",
    headers: ["Área", "Items Registrados", "Icono Ref."],
    rows: areaRows
  });

  return {
    title: "Informe de Inventario de Activos",
    metadata,
    sections
  };
};

/**
 * Generates a global combined report
 */
export const generateGlobalReport = (data, dateFilter) => {
  const fin = generateFinanceReport(data.transactions, dateFilter);
  const alm = generateWarehouseReport(data.movements, dateFilter);
  const inv = generateInventoryReport(data.inventorySummary, dateFilter);

  return {
    title: `Informe Ejecutivo Global Integrado`,
    metadata: fin.metadata,
    sections: [
      {
        title: "I. MÓDULO FINANCIERO",
        type: "header_section"
      },
      ...fin.sections,
      {
        title: "II. MÓDULO DE ALMACÉN",
        type: "header_section"
      },
      ...alm.sections,
      {
        title: "III. INVENTARIO",
        type: "header_section"
      },
      ...inv.sections
    ]
  };
};
