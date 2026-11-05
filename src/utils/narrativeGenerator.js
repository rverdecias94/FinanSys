
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
    { label: currencies.length > 1 ? "Monedas" : "Moneda", value: currencies.join(' / ') },
    { label: "Base de preparación", value: "Registros operacionales (movimientos registrados; no equivale a caja cobrada)" }
  ];

  const sections = [];

  sections.push({
    title: "0. Nota metodológica",
    content: "Documento de gestión sobre registros operacionales de GESTIA. No constituye un estado financiero preparado mediante contabilidad de partida doble ni certificación contable. Los importes reflejan transacciones registradas en el período (cualquier estado de cobro/pago) y no equivalen a caja cobrada ni a un estado de resultados formal."
  });

  // 3. Sección 1: Resumen ejecutivo (redacción basada en los indicadores calculados)
  const totalTx = transactions.length;
  const totalIncomeCount = transactions.filter(t => t.type === 'income').length;
  const totalExpenseCount = transactions.filter(t => t.type === 'expense').length;

  const txWord = totalTx === 1 ? 'transacción' : 'transacciones';
  let summaryText = `El presente informe consolida ${totalTx} ${txWord} registradas durante ${periodLabel} (${totalIncomeCount} de ingreso y ${totalExpenseCount} de egreso). `;

  currencies.forEach((curr) => {
    const d = dataByCurrency[curr];
    if (!d) return;
    const netRatio = d.incomeTotal > 0 ? (d.net / d.incomeTotal) * 100 : null;
    const coverage = d.expenseTotal > 0 ? d.incomeTotal / d.expenseTotal : null;
    summaryText += `En ${curr}, las entradas registradas totalizaron ${fmt(d.incomeTotal, curr)} frente a salidas registradas por ${fmt(d.expenseTotal, curr)}, con un flujo neto registrado ${d.net >= 0 ? 'positivo (se registró más entrada que salida)' : 'negativo (se registró más salida que entrada)'} de ${fmt(d.net, curr)}`;
    if (netRatio !== null) summaryText += `, y una relación flujo neto/entradas registradas del ${netRatio.toFixed(1)}%`;
    if (coverage !== null) summaryText += `; la razón entradas/salidas registradas es ${coverage.toFixed(2)}x`;
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
      return `- **${curr} (${comparisonLabel}):** Entradas registradas ${fmt(deltaIncome, curr)} (${fmtPct(incomePct)}), Salidas registradas ${fmt(deltaExpense, curr)} (${fmtPct(expensePct)}), Flujo neto registrado ${fmt(deltaNet, curr)} (${fmtPct(netPct)}).`
    })

    sections.push({
      title: '2. Comparación con Periodo Anterior',
      type: 'list',
      items
    })
  }

  // 4. Resumen de entradas/salidas registradas por moneda
  const resultHeaders = ["Concepto", ...currencies.map(c => `Importe (${c})`)];
  const resultRows = [
    ["Entradas registradas", ...currencies.map(c => fmt(dataByCurrency[c]?.incomeTotal || 0, c))],
    ["Salidas registradas", ...currencies.map(c => fmt(dataByCurrency[c]?.expenseTotal || 0, c))],
    ["Flujo neto registrado", ...currencies.map(c => fmt(dataByCurrency[c]?.net || 0, c))]
  ];

  const resultNote = currencies.length > 1
    ? `Importes por moneda sin conversión. «Flujo neto registrado» = entradas registradas − salidas registradas; no equivale a caja cobrada ni a un estado de resultados formal.`
    : `Resumen del período sobre movimientos registrados. «Flujo neto registrado» = entradas − salidas registradas; no equivale a caja cobrada ni a un estado de resultados formal.`

  sections.push({
    title: prevByCurrency ? "3. Resumen de Ingresos y Gastos" : "2. Resumen de Ingresos y Gastos",
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

  // 6. Top gastos por moneda (nunca ordenar montos cruzando monedas)
  const topExpenseRows = []
  currencies.forEach((curr) => {
    const expenses = (dataByCurrency[curr]?.expenseTxs || [])
      .slice()
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5)
    expenses.forEach((t) => {
      topExpenseRows.push([
        curr,
        t.category || 'Sin categoría',
        fmt(Number(t.amount), curr),
        t.details?.payment_method || 'Efectivo',
        t.description || '-'
      ])
    })
  })

  if (topExpenseRows.length > 0) {
    sections.push({
      title: prevByCurrency ? "5. Detalle de Gastos Principales" : "4. Detalle de Gastos Principales",
      type: "table",
      headers: ["Moneda", "Categoría", "Monto", "Método", "Observaciones"],
      rows: topExpenseRows,
      notes: "Hasta 5 gastos por moneda, ordenados dentro de cada moneda. No se comparan importes entre monedas distintas."
    });
  }

  // 7. Indicadores de gestión (calculados sobre los datos del período)
  const kpis = [];
  currencies.forEach(curr => {
    const d = dataByCurrency[curr];
    if (!d || (d.incomeTotal === 0 && d.expenseTotal === 0)) return;
    const tag = currencies.length > 1 ? ` (${curr})` : '';

    if (d.incomeTotal > 0) {
      kpis.push([`Relación flujo neto/entradas registradas${tag}`, `${((d.net / d.incomeTotal) * 100).toFixed(1)}%`]);
    }
    if (d.expenseTotal > 0) {
      kpis.push([`Razón entradas/salidas registradas${tag}`, `${(d.incomeTotal / d.expenseTotal).toFixed(2)}x`]);
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
      kpis.push([`Salidas registradas con método efectivo${tag}`, `${((cashExpenses / d.expenseTotal) * 100).toFixed(0)}%`]);
    }
  });

  sections.push({
    title: prevByCurrency ? "6. Indicadores del período" : "5. Indicadores del período",
    type: "table",
    headers: ["Indicador", "Valor"],
    rows: kpis,
    notes: `Indicadores sobre movimientos registrados del período (no caja liquidada). «Relación flujo neto/entradas registradas» = (entradas − salidas) / entradas. «Razón entradas/salidas registradas» > 1x indica más entradas que salidas registradas.`
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

  // 8. Conclusiones por cada moneda con actividad (descriptivas; sin utilidad/rentabilidad)
  const conclusions = []
  const activeCurrencies = currencies.filter((curr) => {
    const d = dataByCurrency[curr]
    return d && (d.incomeTotal > 0 || d.expenseTotal > 0)
  })

  if (activeCurrencies.length === 0) {
    conclusions.push('**Flujo neto registrado:** no se registró actividad financiera relevante en el período analizado.')
  }

  activeCurrencies.forEach((curr) => {
    const d = dataByCurrency[curr]
    const netRatio = d.incomeTotal > 0 ? (d.net / d.incomeTotal) * 100 : null
    if (d.net >= 0) {
      conclusions.push(
        `**Flujo neto registrado (${curr}):** ${fmt(d.net, curr)}${netRatio !== null ? ` (relación flujo neto/entradas registradas ${netRatio.toFixed(1)}%)` : ''}. Se registraron más entradas que salidas en esta moneda.`
      )
    } else {
      conclusions.push(
        `**Flujo neto registrado (${curr}):** ${fmt(d.net, curr)}. Se registraron más salidas que entradas en esta moneda.`
      )
    }

    if (d.expenseTotal > 0) {
      const expCats = sumByCategory(d.expenseTxs)
      const topExp = Object.entries(expCats).sort((a, b) => b[1] - a[1])[0]
      if (topExp) {
        const share = (topExp[1] / d.expenseTotal) * 100
        conclusions.push(
          `**Salidas por categoría (${curr}):** "${topExp[0]}" concentra el ${share.toFixed(0)}% de las salidas registradas (${fmt(topExp[1], curr)}).`
        )
      }
    }

    if (d.incomeTotal > 0) {
      const incCats = sumByCategory(d.incomeTxs)
      const topInc = Object.entries(incCats).sort((a, b) => b[1] - a[1])[0]
      if (topInc) {
        const share = (topInc[1] / d.incomeTotal) * 100
        conclusions.push(
          `**Entradas por categoría (${curr}):** "${topInc[0]}" representa el ${share.toFixed(0)}% de las entradas registradas.`
        )
      }
    }
  })

  sections.push({
    title: prevByCurrency ? "8. Conclusiones y Recomendaciones" : "6. Conclusiones y Recomendaciones",
    type: "list",
    items: conclusions
  });

  return {
    title: `Resumen financiero del período`,
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

  // Section 1: Summary — conteos de movimientos/productos; NO sumar qty entre UDM distintas
  const ins = movements.filter(m => m.type === 'in');
  const outs = movements.filter(m => m.type === 'out');

  const products = {};
  movements.forEach(m => {
    const name = m.products?.name || 'Desconocido';
    if (!products[name]) products[name] = { in: 0, out: 0 };
    products[name][m.type] = (products[name][m.type] || 0) + Number(m.qty || 0);
  });
  const productCount = Object.keys(products).length;

  const entradaWord = ins.length === 1 ? 'entrada' : 'entradas'
  const salidaWord = outs.length === 1 ? 'salida' : 'salidas'
  const productoWord = productCount === 1 ? 'producto' : 'productos'
  let warehouseSummary = `Durante ${dateFilter?.label || 'el período'} se registraron ${movements.length} movimientos de almacén (${ins.length} ${entradaWord} y ${outs.length} ${salidaWord}) sobre ${productCount} ${productoWord}. `;
  warehouseSummary += 'Las cantidades se detallan por producto; no se agregan unidades de medida distintas en un solo total. ';
  warehouseSummary += 'Este resumen describe actividad física registrada y no calcula un indicador de rotación de inventario ni valoración de existencias.';

  sections.push({
    title: "1. Resumen Operativo de Almacén",
    content: warehouseSummary
  });

  const productRows = Object.entries(products)
    .sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out))
    .slice(0, 10)
    .map(([name, counts]) => [name, counts.in.toString(), counts.out.toString(), (counts.in - counts.out).toString()]);

  sections.push({
    title: "2. Flujo de Productos (Top 10)",
    type: "table",
    headers: ["Producto", "Entradas", "Salidas", "Balance Periodo"],
    rows: productRows,
    notes: "Balance del período = entradas − salidas del mismo producto. No comparar ni sumar filas con unidades de medida distintas."
  });

  const topName = productRows[0]?.[0] || 'N/A';
  const top = products[topName];
  const conclusions = [
    `**Actividad registrada:** ${movements.length} movimientos sobre ${productCount} ${productoWord} en el período.`,
    top
      ? `**Producto con mayor actividad:** "${topName}" (entradas ${top.in}, salidas ${top.out}; balance del período ${top.in - top.out}).`
      : '**Producto con mayor actividad:** no hay movimientos en el período.',
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
    { label: "Total de ítems", value: totalItems.toString() }
  ];

  // Section 1: Summary
  const sortedAreas = [...inventorySummary].sort((a, b) => (b.itemsCount || 0) - (a.itemsCount || 0));
  const topArea = sortedAreas[0];
  const emptyAreas = inventorySummary.filter(a => !((a.itemsCount || 0) > 0)).length;
  let inventorySummaryText = `El inventario se distribuye en ${inventorySummary.length} áreas operativas, con un total de ${totalItems} ítems registrados. `;
  if (topArea && totalItems > 0) {
    const share = ((topArea.itemsCount || 0) / totalItems) * 100;
    inventorySummaryText += `El área "${topArea.name}" concentra la mayor parte de las existencias (${topArea.itemsCount} ítems, ${share.toFixed(0)}% del total), lo que la convierte en el foco principal de control de existencias.`;
  }
  if (emptyAreas > 0) {
    inventorySummaryText += ` ${emptyAreas === 1 ? '1 área no registró' : `${emptyAreas} áreas no registraron`} ítems en el período, susceptible${emptyAreas === 1 ? '' : 's'} de revisión o consolidación.`;
  }

  sections.push({
    title: "1. Estado del Inventario por Áreas",
    content: inventorySummaryText
  });

  // Section 2: Area Breakdown Table — participación (% del total) en lugar del icono
  // (un dato decorativo sin valor analítico). Cierra con una fila de Total que cuadra al 100%.
  const areaRows = sortedAreas.map(area => {
    const count = area.itemsCount || 0;
    const share = totalItems > 0 ? (count / totalItems) * 100 : 0;
    return [area.name, count.toString(), `${share.toFixed(1)}%`];
  });
  areaRows.push(['Total', totalItems.toString(), totalItems > 0 ? '100.0%' : '0.0%']);

  sections.push({
    title: "2. Desglose por Área",
    type: "table",
    headers: ["Área", "Ítems registrados", "Participación"],
    rows: areaRows,
    notes: "La participación es el porcentaje de los ítems registrados que concentra cada área en el período; ayuda a identificar dónde se acumula el inventario y a priorizar su control."
  });

  return {
    title: "Informe de Inventario (Existencias)",
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
