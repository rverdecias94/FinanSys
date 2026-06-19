
import { format } from 'date-fns';

/**
 * Helper to format currency numbers
 */
const fmt = (num, currency) => {
  const value = Number(num)
  const safe = Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      style: currency ? 'currency' : 'decimal',
      currency: currency || undefined
    }).format(safe);
  } catch {
    // P2.5: un código de moneda no-ISO lanza RangeError y rompía el reporte Word
    // y la previsualización. Fallback: número decimal + código de moneda.
    const decimal = new Intl.NumberFormat('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safe)
    return currency ? `${decimal} ${currency}` : decimal
  }
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
    { label: "Período analizado", value: periodLabel },
    { label: "Fecha de emisión", value: reportDate },
    { label: currencies.length > 1 ? "Monedas funcionales" : "Moneda funcional", value: currencies.join(' / ') },
    { label: "Base de preparación", value: "Movimientos de caja registrados (base de efectivo)" }
  ];

  const sections = [];

  // 3. Sección 1: Resumen ejecutivo (redacción basada en los indicadores calculados)
  const totalTx = transactions.length;
  const totalIncomeCount = transactions.filter(t => t.type === 'income').length;
  const totalExpenseCount = transactions.filter(t => t.type === 'expense').length;

  const txWord = totalTx === 1 ? 'transacción' : 'transacciones';
  let summaryText = `El presente informe consolida ${totalTx} ${txWord} registradas durante ${periodLabel} (${totalIncomeCount} de ingreso y ${totalExpenseCount} de egreso operativo). `;

  currencies.forEach((curr) => {
    const d = dataByCurrency[curr];
    if (!d) return;
    const margin = d.incomeTotal > 0 ? (d.net / d.incomeTotal) * 100 : null;
    const coverage = d.expenseTotal > 0 ? d.incomeTotal / d.expenseTotal : null;
    summaryText += `En ${curr}, los ingresos totalizaron ${fmt(d.incomeTotal, curr)} frente a egresos por ${fmt(d.expenseTotal, curr)}, arrojando un resultado neto ${d.net >= 0 ? 'positivo (superávit)' : 'negativo (déficit)'} de ${fmt(d.net, curr)}`;
    if (margin !== null) summaryText += `, con un margen neto del ${margin.toFixed(1)}%`;
    if (coverage !== null) summaryText += ` y una razón de cobertura de gastos de ${coverage.toFixed(2)}x`;
    summaryText += '. ';
  });

  sections.push({
    title: "1. Resumen Ejecutivo",
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

  const resultNote = currencies.length > 1
    ? `El estado de resultados se presenta segregado por moneda funcional, sin conversión a una unidad de reporte única; su lectura consolidada debe considerar la exposición cambiaria entre las monedas operadas.`
    : `Estado de resultados elaborado sobre base de efectivo, según los movimientos registrados en el período. El resultado neto refleja la diferencia entre ingresos y egresos efectivamente contabilizados.`

  sections.push({
    title: prevByCurrency ? "3. Estado de Resultados" : "2. Estado de Resultados",
    type: "table",
    headers: resultHeaders,
    rows: resultRows,
    notes: resultNote
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

  // 7. Indicadores de gestión (calculados sobre los datos del período)
  const kpis = [];
  currencies.forEach(curr => {
    const d = dataByCurrency[curr];
    if (!d || (d.incomeTotal === 0 && d.expenseTotal === 0)) return;
    const tag = currencies.length > 1 ? ` (${curr})` : '';

    if (d.incomeTotal > 0) {
      kpis.push([`Margen neto${tag}`, `${((d.net / d.incomeTotal) * 100).toFixed(1)}%`]);
    }
    if (d.expenseTotal > 0) {
      kpis.push([`Razón de cobertura de gastos${tag}`, `${(d.incomeTotal / d.expenseTotal).toFixed(2)}x`]);
    }
    if (d.incomeCount > 0) {
      kpis.push([`Ticket promedio de ingreso${tag}`, fmt(d.incomeTotal / d.incomeCount, curr)]);
    }
    if (d.expenseCount > 0) {
      kpis.push([`Ticket promedio de egreso${tag}`, fmt(d.expenseTotal / d.expenseCount, curr)]);
    }
    if (d.incomeTotal > 0) {
      const incCats = sumByCategory(d.incomeTxs);
      const topInc = Object.entries(incCats).sort((a, b) => b[1] - a[1])[0];
      if (topInc) kpis.push([`Concentración de ingresos${tag}`, `${((topInc[1] / d.incomeTotal) * 100).toFixed(0)}% en ${topInc[0]}`]);
    }
    if (d.expenseTotal > 0) {
      const cashExpenses = d.expenseTxs
        .filter(t => !t.details?.payment_method || /efectivo|cash/i.test(t.details.payment_method))
        .reduce((s, t) => s + Number(t.amount), 0);
      kpis.push([`Gastos liquidados en efectivo${tag}`, `${((cashExpenses / d.expenseTotal) * 100).toFixed(0)}%`]);
    }
  });

  sections.push({
    title: prevByCurrency ? "6. Indicadores de Gestión Financiera" : "5. Indicadores de Gestión Financiera",
    type: "table",
    headers: ["Indicador", "Valor"],
    rows: kpis,
    notes: `Indicadores calculados sobre los movimientos del período. El margen neto mide la proporción del ingreso que se traduce en resultado; la razón de cobertura, las veces que los ingresos cubren los egresos (valores > 1x indican superávit).`
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

  // 8. Conclusiones y recomendaciones (derivadas de la moneda principal del período)
  const primaryCurr = currencies[0]
  const dp = dataByCurrency[primaryCurr] || { incomeTotal: 0, expenseTotal: 0, net: 0, incomeTxs: [], expenseTxs: [] }
  const conclusions = []

  if (dp.incomeTotal > 0 || dp.expenseTotal > 0) {
    const margin = dp.incomeTotal > 0 ? (dp.net / dp.incomeTotal) * 100 : null
    if (dp.net >= 0) {
      conclusions.push(`**Resultado del ejercicio:** el período cerró con superávit de ${fmt(dp.net, primaryCurr)}${margin !== null ? ` y un margen neto del ${margin.toFixed(1)}%` : ''}, lo que evidencia capacidad de generación de excedentes y autofinanciación operativa.`)
    } else {
      conclusions.push(`**Resultado del ejercicio:** el período cerró con déficit de ${fmt(dp.net, primaryCurr)}, situación que reduce el capital de trabajo disponible y exige medidas de contención del gasto o de incremento de ingresos.`)
    }
  } else {
    conclusions.push(`**Resultado del ejercicio:** no se registró actividad financiera relevante en el período analizado.`)
  }

  if (dp.expenseTotal > 0) {
    const expCats = sumByCategory(dp.expenseTxs)
    const topExp = Object.entries(expCats).sort((a, b) => b[1] - a[1])[0]
    if (topExp) {
      const share = (topExp[1] / dp.expenseTotal) * 100
      conclusions.push(`**Estructura del gasto:** la partida "${topExp[0]}" concentra el ${share.toFixed(0)}% del egreso total (${fmt(topExp[1], primaryCurr)}); se recomienda su seguimiento prioritario en el control presupuestario.`)
    }
  }

  if (dp.incomeTotal > 0) {
    const incCats = sumByCategory(dp.incomeTxs)
    const topInc = Object.entries(incCats).sort((a, b) => b[1] - a[1])[0]
    if (topInc) {
      const share = (topInc[1] / dp.incomeTotal) * 100
      if (share >= 60) {
        conclusions.push(`**Riesgo de concentración:** el ${share.toFixed(0)}% de los ingresos proviene de "${topInc[0]}", lo que supone una dependencia elevada de una única fuente; se aconseja diversificar la cartera de ingresos para mitigar el riesgo.`)
      } else {
        conclusions.push(`**Diversificación de ingresos:** la fuente principal ("${topInc[0]}") representa el ${share.toFixed(0)}% del total, lo que denota una base de ingresos razonablemente diversificada.`)
      }
    }
  }

  if (conclusions.length === 0) {
    conclusions.push('No se dispone de datos suficientes para emitir conclusiones cuantitativas en el período seleccionado.')
  }

  sections.push({
    title: prevByCurrency ? "8. Conclusiones y Recomendaciones" : "6. Conclusiones y Recomendaciones",
    type: "list",
    items: conclusions
  });

  return {
    title: `Informe de Gestión Financiera`,
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
  const totalIn = ins.reduce((s, m) => s + Number(m.qty || 0), 0);
  const totalOut = outs.reduce((s, m) => s + Number(m.qty || 0), 0);
  const netFlow = totalIn - totalOut;
  const rotation = totalIn > 0 ? (totalOut / totalIn) : null;

  let warehouseSummary = `Durante ${dateFilter?.label || 'el período'} se registraron ${movements.length} movimientos de inventario: ${ins.length} entradas de abastecimiento (${totalIn} unidades) y ${outs.length} salidas por consumo o venta (${totalOut} unidades). `;
  warehouseSummary += `El flujo neto de unidades fue ${netFlow >= 0 ? `positivo (+${netFlow})` : `negativo (${netFlow})`}`;
  if (rotation !== null) warehouseSummary += `, con un índice de rotación (salidas/entradas) de ${rotation.toFixed(2)}x`;
  warehouseSummary += '.';

  sections.push({
    title: "1. Resumen Operativo de Almacén",
    content: warehouseSummary
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
    netFlow >= 0
      ? `**Política de inventario:** el período presenta acumulación neta de existencias (+${netFlow} unidades), lo que incrementa la inmovilización de capital en stock; conviene ajustar el reabastecimiento a la demanda real.`
      : `**Política de inventario:** el período presenta reducción neta de existencias (${netFlow} unidades), con rotación superior al abastecimiento; conviene vigilar los niveles de stock para evitar rupturas.`,
    `**Producto crítico:** el ítem con mayor actividad fue "${productRows[0]?.[0] || 'N/A'}", concentrando el mayor volumen de movimientos del período.`
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
  const sortedAreas = [...inventorySummary].sort((a, b) => (b.itemsCount || 0) - (a.itemsCount || 0));
  const topArea = sortedAreas[0];
  let inventorySummaryText = `El inventario se distribuye en ${inventorySummary.length} áreas operativas, con un total de ${totalItems} ítems registrados. `;
  if (topArea && totalItems > 0) {
    const share = ((topArea.itemsCount || 0) / totalItems) * 100;
    inventorySummaryText += `El área "${topArea.name}" concentra la mayor densidad de activos (${topArea.itemsCount} ítems, ${share.toFixed(0)}% del total), lo que define el foco principal de control y valoración.`;
  }

  sections.push({
    title: "1. Estado del Inventario por Áreas",
    content: inventorySummaryText
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
