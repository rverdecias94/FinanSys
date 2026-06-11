
import { format } from 'date-fns';

/**
 * Helper to format currency numbers
 */
const fmt = (num, currency) => {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: currency ? 'currency' : 'decimal',
    currency: currency
  }).format(num);
}

const getCurrencies = (rows) => {
  const currencies = [...new Set((rows || []).map(t => t.currency).filter(Boolean))]
  return currencies.length ? currencies : ['USD']
}

const buildFinanceDataByCurrency = (transactions, currencies) => {
  const dataByCurrency = {}
  currencies.forEach(curr => {
    const txs = (transactions || []).filter(t => t.currency === curr)
    const income = txs.filter(t => t.type === 'income')
    const expense = txs.filter(t => t.type === 'expense')

    const incomeTotal = income.reduce((sum, t) => sum + Number(t.amount), 0)
    const expenseTotal = expense.reduce((sum, t) => sum + Number(t.amount), 0)

    dataByCurrency[curr] = {
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
      incomeCount: income.length,
      expenseCount: expense.length,
      incomeTxs: income,
      expenseTxs: expense
    }
  })
  return dataByCurrency
}

const sumByCategory = (txs) => {
  const cats = {}
  ;(txs || []).forEach(t => {
    const key = t.category || 'Sin categoría'
    cats[key] = (cats[key] || 0) + Number(t.amount)
  })
  return cats
}

const pct = (num, den) => {
  const n = Number(num)
  const d = Number(den)
  if (!d) return null
  return (n / d) * 100
}

/**
 * Analyzes transactions to generate a structured finance report
 */
export const generateFinanceReport = (transactions, dateFilter, comparison = null) => {
  const reportDate = format(new Date(), 'dd/MM/yyyy');
  const periodLabel = dateFilter?.label || 'Periodo no especificado';

  const comparisonTransactions = comparison?.comparisonTransactions || []
  const comparisonLabel = comparison?.comparisonLabel || 'Periodo anterior'

  const currencies = getCurrencies(transactions)
  const dataByCurrency = buildFinanceDataByCurrency(transactions, currencies)
  const prevByCurrency = comparisonTransactions.length ? buildFinanceDataByCurrency(comparisonTransactions, currencies) : null

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

  let summaryText = `Durante el periodo analizado, se registraron un total de ${totalTx} operaciones. `;

  currencies.forEach((curr) => {
    if (dataByCurrency[curr]) {
      const net = dataByCurrency[curr].net;
      summaryText += `En ${curr}, se observa ${net >= 0 ? 'un superávit' : 'un déficit'} operativo de ${fmt(Math.abs(net), curr)}. `;
    }
  });

  summaryText += "El flujo de caja muestra una dinámica mixta con predominio de operaciones corrientes.";

  sections.push({
    title: "1. Resumen General de Operaciones",
    content: summaryText
  });

  if (prevByCurrency) {
    const items = currencies.map(curr => {
      const cur = dataByCurrency[curr]
      const prev = prevByCurrency[curr]
      const deltaIncome = (cur?.incomeTotal || 0) - (prev?.incomeTotal || 0)
      const deltaExpense = (cur?.expenseTotal || 0) - (prev?.expenseTotal || 0)
      const deltaNet = (cur?.net || 0) - (prev?.net || 0)

      const incomePct = pct(deltaIncome, prev?.incomeTotal || 0)
      const expensePct = pct(deltaExpense, prev?.expenseTotal || 0)
      const netPct = pct(deltaNet, Math.abs(prev?.net || 0))

      const fmtPct = (v) => (v === null ? 'N/A' : `${(v >= 0 ? '+' : '')}${v.toFixed(0)}%`)
      return `- **${curr} (${comparisonLabel}):** Ingresos ${fmt(deltaIncome, curr)} (${fmtPct(incomePct)}), Gastos ${fmt(deltaExpense, curr)} (${fmtPct(expensePct)}), Neto ${fmt(deltaNet, curr)} (${fmtPct(netPct)}).`
    })

    sections.push({
      title: '2. Comparación con Periodo Anterior',
      type: 'list',
      items
    })
  }

  // 4. Section 2: Statement of Results (Table)
  const resultHeaders = ["Concepto", ...currencies.map(c => `Importe (${c})`)];
  const resultRows = [
    ["Ingresos totales", ...currencies.map(c => fmt(dataByCurrency[c]?.incomeTotal || 0, c))],
    ["Gastos totales", ...currencies.map(c => fmt(dataByCurrency[c]?.expenseTotal || 0, c))],
    ["Resultado neto", ...currencies.map(c => fmt(dataByCurrency[c]?.net || 0, c))]
  ];

  sections.push({
    title: prevByCurrency ? "3. Estado de Resultados Parcial" : "2. Estado de Resultados Parcial",
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
      incomeAnalysis.push(`- **Ingresos en ${curr}:** Total de ${fmt(dataByCurrency[curr].incomeTotal, curr)}. Principal fuente: ${topCat[0]} (${fmt(topCat[1], curr)}).`);
    }
  });

  if (incomeAnalysis.length === 0) incomeAnalysis.push("No se registraron ingresos en el periodo.");

  sections.push({
    title: prevByCurrency ? "4. Análisis de Ingresos" : "3. Análisis de Ingresos",
    type: "list",
    items: incomeAnalysis,
    notes: ""
  });

  // 6. Section 4: Expense Analysis (Table)
  // Top 5 expenses
  const topExpenses = transactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 5)
    .map(t => [
      t.category || 'Sin categoría',
      `${fmt(Number(t.amount), t.currency)}`,
      t.details?.payment_method || 'Efectivo',
      t.description || '-'
    ]);

  if (topExpenses.length > 0) {
    sections.push({
      title: prevByCurrency ? "5. Detalle de Gastos Principales" : "4. Detalle de Gastos Principales",
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
      kpis.push([`% Gastos en Efectivo (${curr})`, `${cashPct}% (${fmt(cashExpenses, curr)} de ${fmt(d.expenseTotal, curr)})`]);
    }
  });

  sections.push({
    title: prevByCurrency ? "6. Indicadores de Gestión Financiera" : "5. Indicadores de Gestión Financiera",
    type: "table",
    headers: ["Indicador", "Valor"],
    rows: kpis
  });

  if (prevByCurrency) {
    const anomalies = []
    currencies.forEach(curr => {
      const cur = dataByCurrency[curr]
      const prev = prevByCurrency[curr]
      if (!cur || !prev) return

      const curCats = sumByCategory(cur.expenseTxs)
      const prevCats = sumByCategory(prev.expenseTxs)

      const changes = Object.keys({ ...curCats, ...prevCats })
        .map((cat) => {
          const c = curCats[cat] || 0
          const p = prevCats[cat] || 0
          const delta = c - p
          const pPct = pct(delta, p)
          return { cat, c, p, delta, pPct }
        })
        .filter(x => x.p > 0 && x.pPct !== null)
        .sort((a, b) => (b.pPct || 0) - (a.pPct || 0))

      const topGrowth = changes.find(x => (x.pPct || 0) >= 30)
      if (topGrowth) {
        anomalies.push(`- **${curr}:** La categoría **${topGrowth.cat}** aumentó ${topGrowth.pPct.toFixed(0)}% (${fmt(topGrowth.p, curr)} → ${fmt(topGrowth.c, curr)}).`)
      }

      const curTopExpense = (cur.expenseTxs || [])
        .slice()
        .sort((a, b) => Number(b.amount) - Number(a.amount))[0]
      const prevTopExpense = (prev.expenseTxs || [])
        .slice()
        .sort((a, b) => Number(b.amount) - Number(a.amount))[0]

      if (curTopExpense && prevTopExpense) {
        const jump = pct(Number(curTopExpense.amount) - Number(prevTopExpense.amount), Number(prevTopExpense.amount))
        if (jump !== null && jump >= 50) {
          anomalies.push(`- **${curr}:** El mayor gasto subió ${jump.toFixed(0)}% (${fmt(Number(prevTopExpense.amount), curr)} → ${fmt(Number(curTopExpense.amount), curr)}).`)
        }
      }
    })

    if (anomalies.length) {
      sections.push({
        title: '7. Tendencias y Alertas',
        type: 'list',
        items: anomalies
      })
    }
  }

  // 8. Conclusions
  const conclusions = [
    `1. Situación Financiera: El periodo cierra con resultados operativos variables según la moneda.`,
    `2. Gestión de Gastos: Se recomienda monitorear las categorías con mayor incidencia en el presupuesto.`,
    `3. Política de Pagos: ${kpis.some(k => k[1].includes('100%')) ? 'Alta dependencia del efectivo.' : 'Diversificación adecuada de medios de pago.'}`
  ];

  sections.push({
    title: prevByCurrency ? "8. Conclusiones y Recomendaciones" : "6. Conclusiones y Recomendaciones",
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
  const fin = generateFinanceReport(
    data.transactions,
    dateFilter,
    data?.prevTransactions?.length ? { comparisonTransactions: data.prevTransactions, comparisonLabel: data.prevLabel || 'Periodo anterior' } : undefined
  );
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
