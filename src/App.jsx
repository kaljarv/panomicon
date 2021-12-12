/* eslint-disable no-useless-constructor */

/* 
 * TODO
 *
 * In non-prop view, vary opacity based on expression specificity
 * Move l1 ths to first items on l2 and link hiding to them
 * Add cross-highlighting on hover
 */

import React from 'react';

import './App.css';


/* 
 * Helper functions 
 *
 * These should be moved into a Context or smth...
 * 
 */
const toClassName = function toClassName(name) {
  return name.toString().replace(/\P{L}/ug, '_');
}

const getClassNames = function getClassNames(column) {
  // Get class names based on column group and column name.
  // The same class names are used for both body and header cells.
  const group = 'parent' in column ? column.parent : column;
  return `${CLASS_NAMES.colgroup}${toClassName(group.name)} ${CLASS_NAMES.col}${toClassName(column.name)}`;
}

const extractColumns = function extractColumns(dataset) {
  if (dataset.length < 1)
    throw new Error('Dataset is empty!');
  if (dataset[0].nearest_genes.length < 1)
    throw new Error('First credible set in dataset has no genes!');

  const d = dataset[0].nearest_genes[0],
        columns = [...NON_ANNOTATION_COLS];
  for (const g in ANNOTATION_COLS)
    columns.push({
      name:  g,
      items: ANNOTATION_COLS[g](d)
    });
  for (const g of columns)
    for (const c of g.items)
      c.parent = g;
  return columns;
}

const findItem = function findItem(items, name, nameKey = 'name') {
  for (const item of items)
    if (item[nameKey] === name) return item;
  return null;
}

const getItems = function getItems(groupName, dataSource) {
  // ANNOTATION_COLS contains a getter for the group data
  return ANNOTATION_COLS[groupName](dataSource);
}

const getValue = function getValue(groupName, itemName, dataSource) {
  const item = findItem(getItems(groupName, dataSource), itemName);
  if (item)
    return item.value;
  else
    return null;
}

const getSum = function getSum(groupName, valueKey, dataSource) {
  const  values = getItems(groupName, dataSource)
                    .map(i => valueKey === null ? i.value : i.value[valueKey])
                    .filter(v => v !== UNKNOWN_EXPRESSION_VALUE);
  return values.reduce((sum, item) => sum + item, 0);
}

const getCombinedExpression = function getCombinedExpression(expressions, keys = ['rna_value', 'protein_level']) {
  // Calculate a single expression value [0,1] for each tissue in expressions.
  // The values are first normalised for each key. Then the total value is
  // calculated as the average of these weighted by the inverse number of
  // unknown values for that key.
  const num = expressions.length,
        totals = {},
        unknowns = {},
        weights = {},
        averages = [];

  for (const k of keys) {
    totals[k] = unknowns[k] = 0;
    for (const e of expressions) {
      if (e[k] === UNKNOWN_EXPRESSION_VALUE)
        unknowns[k] += 1;
      else
        totals[k] += e[k];
    }
    weights[k] = (num - unknowns[k]) / num;
  }

  for (const e of expressions) {
    let value = 0,
        notUnknown = false;
    for (const k of keys) {
      // Weight of 0 entails an average of 0, which would result in div by 0
      if (weights[k] === 0 || e[k] === UNKNOWN_EXPRESSION_VALUE)
        continue;
      value += e[k] / totals[k] * weights[k];
      notUnknown = true;
    }
    averages.push(notUnknown ? value : UNKNOWN_EXPRESSION_VALUE);
  }
  return averages;
}

const getSummary = function getSummary(dataset) {
  // Creates a credible-set-type data row that has summary stats for all columns

  const columns   = extractColumns(dataset),
        betas     = {},
        flatBetas = {};
  
  for (const gc in ANNOTATION_COLS)
    betas[gc] = [[], []]; // The first list is for pos betas, the other for negs

  for (const d of dataset) {
    const bIndex = d.lead_beta > 0 ? 0 : 1;
    for (const gc in ANNOTATION_COLS) {
      const isBinary  = ['Pathways', 'Mouse phenotypes'].includes(gc),
            vals      = ANNOTATION_COLS[gc](d.nearest_genes[0]),
            fractions = isBinary ? 
                        vals.map(v => (v.value ? 1 / vals.filter(v => v.value).length : 0)) : // Trues normalized by their number
                        getCombinedExpression(vals.map(v => v.value)).map(v => v === UNKNOWN_EXPRESSION_VALUE ? 0 : v);
      betas[gc][bIndex].push(fractions.map(v => v * d.lead_beta));
    }    
  }

  // Flatten betas
  for (const gc in betas) {
    flatBetas[gc] = [];
    for (let bIndex = 0; bIndex < 2; bIndex++) {
      const bb = betas[gc][bIndex],
            flatVals = [];
      for (let cIndex = 0; cIndex < bb[0].length; cIndex++)
        flatVals.push(
          bb.map(b => b[cIndex]).reduce((sum, val) => sum + val)
        );
      flatBetas[gc][bIndex] = flatVals;
    }
  }

  const _mapBetas = function _mapBetas(groupName) {
    const group = findItem(columns, groupName),
          vals = group.items.map((item, index) => ({
                    name: item.name,
                    value: [0, 1].map(bIndex => flatBetas[groupName][bIndex][index])
                  })),
          absVals = vals.map(v => v.value).flat().map(v => Math.abs(v)),
          scale = Math.max(...absVals);
    // Normalize values and force positive
    vals.forEach(vv => vv.value = vv.value.map(v => scale === 0 ? 0 : Math.abs(v / scale)));
    return vals;
  }

  return {
    locus: "SUMMARY",
    type: "summary",
    pval: null, 
    lead_beta: null,
    nearest_genes: [{
      type: "summary",
      id: null, 
      approved_symbol: 'Leads only!', 
      biotype: null,
      expressions: {
        anatomical_systems: _mapBetas('Anatomical systems'),
        organs: _mapBetas('Organs'),
      },
      pathways: _mapBetas('Pathways'),
      mouse_phenotypes: _mapBetas('Mouse phenotypes')
    }]
  };
}

const toggle = function toggle(set, value) {
  if (set.has(value))
    set.delete(value);
  else
    set.add(value);
  return set;
}
const _listHideStyles = function _listHideStyles(dataset) {
  // Create list of hide styles
  console.log(
    extractColumns(dataset).map(cg => cg.items).flat().map(c => 
      `.${CLASS_NAMES.hide + CLASS_NAMES.col + toClassName(c.name)} .${CLASS_NAMES.col + toClassName(c.name)}`
    ).join(',\n')
  );
}


class NumberFormatter {
  constructor(decimalPlaces = 2, useLog = false) {
    this.decimals = decimalPlaces;
    this.localeOptions = {
      minimumFractionDigits: this.decimals,
      maximumFractionDigits: this.decimals
    };
    this.useLog = useLog;
  }

  format(number) {
    let val = this.useLog ? Math.log10(number) : number;
    val = parseFloat(val).toFixed(this.decimals);
    return val.toLocaleString(this.localeOptions);
  }
}


const NON_ANNOTATION_COLS = [
        {
          name: 'Credible set',
          items: [
            {name: 'Lead variant'},
            {name: 'Log(p)'},
            {name: 'Beta'},
        ]},
        {
          name: 'Gene',
          items: [
            {name: 'Approved symbol'},
            {name: 'Coding'}
        ]}
      ],
      // NB. Make sure these match the hard-coded ones in getSummary
      ANNOTATION_COLS = {
        'Anatomical systems': (d) => d.expressions.anatomical_systems,
        'Organs':             (d) => d.expressions.organs,
        'Pathways':           (d) => d.pathways,
        'Mouse phenotypes':   (d) => d.mouse_phenotypes
      },
      NUM_FORMATS = {
        pval:    new NumberFormatter(2, true),
        beta:    new NumberFormatter(2),
        default: new NumberFormatter(2)
      },
      // This should match the one in the ipynb file
      UNKNOWN_EXPRESSION_VALUE = -1,
      MAX_EXPRESSION_VALUES = {
        rna: 6,
        protein: 3
      },
      CLASS_NAMES = {
        betaNeg:  'betaNeg',
        betaPos:  'betaPos',
        col:      'col--',
        colgroup: 'colgroup--',
        colgroupHeader: 'colgroupHeader',
        credibleSet: 'credibleSet--',
        credibleSetSummary: 'credibleSetSummary',
        hide:     'hide--'
      },
      CODING_GENE_TYPE = 'protein_coding',
      APP_OPTIONS = {
        useCombinedExpressions: {
          label: 'Use a relative expression scale combining RNA and protein',
          initialValue: true
        },
        useProportionalExpressions: {
          label: 'Use proportional expressions',
          initialValue: true
        },
        // These are replaced with dynamical hide-prefixed class names
        // showAnatomicalSystems: {
        //   label: 'Show Anatomical system',
        //   initialValue: true
        // },
        // showOrgans: {
        //   label: 'Show Organs',
        //   initialValue: true
        // },
        // showPathways: {
        //   label: 'Show Pathways',
        //   initialValue: true
        // },
        // showMousePhenotypes: {
        //   label: 'Show Mouse phenotypes',
        //   initialValue: true
        // }
      },
      PLACEHOLDER_TD_CLASSNAME = "empty colGroupHeaderTD",
      examplePhenotype = 'HYPOTHYROIDISM',
      exampleDataset = require('./data/Annotated Credible Sets for HYPOTHYROIDISM.json');


class App extends React.Component {

  constructor(props) {
    super(props);

    let options = {};
    for (const o in APP_OPTIONS)
      options[o] = APP_OPTIONS[o].initialValue;

    this.state = {
      phenotype: examplePhenotype,
      dataset:   exampleDataset,
      columns:   extractColumns(exampleDataset),
      hidden:    new Set(),
      options:   options
    }
  }

  componentDidMount() {
    this.setState(prevState => ({
      columns: extractColumns(prevState.dataset)
    }));
  }

  handleInputChange = (event) => {
    const target = event.target,
          value =  target.type === 'checkbox' ? target.checked : target.value,
          name =   target.name;

    this.setState(prevState => ({
      options: {
        ...prevState.options,
        [name]: value
      }
    }));
  }

  handleTHClick = (event, component) => {
    const column = component.props.column;
    this.setState(prevState => ({
      hidden: new Set(toggle(prevState.hidden, column))
    }));
  }

  getAppClassNames() {
    const classNames = ['App'];
    for (const k in this.state.options)
      classNames.push(`option--${k}--${toClassName(this.state.options[k])}`);
    for (const c of this.state.hidden)
      classNames.push(CLASS_NAMES.hide + 
                      CLASS_NAMES['items' in c ? 'colgroup' : 'col'] + 
                      toClassName(c.name));
    return classNames.join(' ');
  }

  render() {

    const phenotype   = this.state.phenotype,
          dataset     = this.state.dataset,
          columns     = this.state.columns,
          options     = this.state.options,
          geneCount   = dataset.map(l => l.nearest_genes.length).reduce((p, c) => p + c),
          summaryData = getSummary(dataset),
          tHeaders    = [];
    let exprType = 'default';
    if (options.useProportionalExpressions)
      exprType = 'proportional';
    if (options.useCombinedExpressions)
      exprType = 'combined';
    for (const cg of columns) {
      // NB. We add an additional empty column for each column group
      tHeaders.push(<DataTH column={cg}
                            clickHandler={this.handleTHClick}
                            key={'colgroupHeader-' + cg.name} />)
      for (const c of cg.items)
        tHeaders.push(<DataTH column={c}
                              clickHandler={this.handleTHClick}
                              key={cg.name + '-' + c.name} />)
    }
      

    return (
      <div className={this.getAppClassNames()}>
        <header className="App-header">
          <h1>Panomicon view for {phenotype}</h1>
          <section className="App-options">
            <p>Credible sets: {dataset.length} • Genes: {geneCount}</p>
            <form>
              {Object.entries(options).map(([k, v]) =>
                <label key={k} >
                  <input name={k}
                         type="checkbox"
                         checked={v}
                         onChange={this.handleInputChange} />
                  {APP_OPTIONS[k].label}
                </label>
              )}
            </form>
          </section>
        </header>
        <table className="DataTable">
          { // <DataCols columns={columns} 
          }
          <thead>
            <tr>
              {tHeaders}
            </tr>
          </thead>
          <tbody>
            <CredibleSet data={summaryData}
                         columns={columns}
                         expressionType={exprType}
                         key="summary" />
            {dataset.map(cs => 
              <CredibleSet data={cs}
                           columns={columns}
                           expressionType={exprType}
                           key={cs.locus} />
            )}
          </tbody>
        </table>
      </div>
    );
  }
}
export default App;


class DataTH extends React.Component {

  constructor(props) {
    super(props);
  }

  handleClick = (event) => {
    if (this.props.clickHandler) {
      this.props.clickHandler(event, this);
      event.preventDefault();
    }
  }

  render() {
    const column =        this.props.column,
          classNames =    ('items' in column ? CLASS_NAMES.colgroupHeader + ' ' : '') + getClassNames(column);

    return (
      <th className={classNames}>
        <span onClick={this.handleClick}>{column.name}</span>
      </th>
    );
  }
}

class CredibleSet extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const columns    = this.props.columns,
          data       = this.props.data,
          isSummary  = data.type === 'summary',
          rowSpan    = data.nearest_genes.length,
          pval       = isSummary ? '—' : NUM_FORMATS.pval.format(data.pval),
          beta       = isSummary ? '—' : NUM_FORMATS.beta.format(data.lead_beta),
          classNames = `${CLASS_NAMES.credibleSet + data.locus} ${isSummary ? CLASS_NAMES.credibleSetSummary : CLASS_NAMES[beta > 0 ? 'betaPos' : 'betaNeg']}`, 
          exprType   = this.props.expressionType;

    const csDetails = (<>
      <td className={PLACEHOLDER_TD_CLASSNAME}
          rowSpan={rowSpan} />
      <td className={getClassNames(columns[0].items[0])}
          rowSpan={rowSpan}>{data.locus}</td>
      <td className={getClassNames(columns[0].items[1])}
          rowSpan={rowSpan}>{pval}</td>
      <td className={getClassNames(columns[0].items[2])}
          rowSpan={rowSpan}>{beta}</td>
    </>);

    return data.nearest_genes.map((gene, i) =>
      <tr key={`${data.locus}-${gene.approved_symbol}`}
          className={classNames}>
        { i === 0 && csDetails }
        <Gene data={gene}
              columns={columns}
              expressionType={exprType} />
      </tr>
    )
  }
}

class Gene extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const columns    = this.props.columns,
          annotCols  = columns.filter(c => c.name in ANNOTATION_COLS),
          data       = this.props.data,
          isSummary  = data.type === 'summary',
          exprType   = this.props.expressionType,
          // An empty td to be inserted as the first item in each col group
          emptyTd    = <td className={PLACEHOLDER_TD_CLASSNAME} />;
    let rnaScale, proteinScale, combinedValues;

    
    return (<>
      {emptyTd}
      <td className={getClassNames(columns[1].items[0])}>
        {data.approved_symbol}
      </td>
      <BinaryValue value={data.biotype === CODING_GENE_TYPE}
                   additionalClass={getClassNames(columns[1].items[1])} />
      {annotCols.map(cg => {

        if (['Anatomical systems', 'Organs'].includes(cg.name)) {
          if (exprType === 'combined') {
            combinedValues = getCombinedExpression(getItems(cg.name, data).map(t => t.value));
          } else {
            rnaScale =     exprType === 'proportional' ? getSum(cg.name, 'rna_value', data) : MAX_EXPRESSION_VALUES.rna;
            proteinScale = exprType === 'proportional' ? getSum(cg.name, 'protein_level', data) : MAX_EXPRESSION_VALUES.protein;
          }
        }

        return [
          // Start with an empty TD for each annotation col group
          emptyTd,
          cg.items.map((c, i) => {
      
            const key = `${cg.name}-${c.name}`,
                  className = getClassNames(c);
            let value = getValue(cg.name, c.name, data);

            if (isSummary) {
              return <ExpressionValue value={value}
                                      expressionType="summary"
                                      key={key}
                                      additionalClass={className} />;
            }

            switch (cg.name) {
              case 'Anatomical systems':
              case 'Organs':
                if (exprType === 'combined')
                  value = [combinedValues[i]];
                else
                  value = [
                    (rnaScale === 0 || value.rna_level === UNKNOWN_EXPRESSION_VALUE ? 
                      UNKNOWN_EXPRESSION_VALUE :
                      (exprType === 'proportional' ? value.rna_value : value.rna_level) / rnaScale),
                    (proteinScale === 0 || value.protein_level === UNKNOWN_EXPRESSION_VALUE ? 
                      UNKNOWN_EXPRESSION_VALUE :
                      value.protein_level / proteinScale)
                  ];
                return <ExpressionValue value={value}
                                        expressionType={exprType}
                                        key={key}
                                        additionalClass={className} />;
              case 'Pathways':
              case 'Mouse phenotypes':
                return <BinaryValue value={value}
                                    key={key}
                                    additionalClass={className} />;
              default:
                return <td key={key}
                          className={className}>{value}</td>;
            }
          })
        ];
      }).flat()}
    </>);
  }
}

class ExpressionValue extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const v         = this.props.value,
          exprType  = this.props.expressionType,
          className = `ExpressionValue ${this.props.additionalClass}`;

    return (
      <td className={className}>
        <svg className="expressionValues"
             viewBox="0 0 100 100">
          {(() => {
            switch (exprType) {
              case 'combined':
                return (<>
                  { v[0] !== UNKNOWN_EXPRESSION_VALUE &&
                    <rect width={v[0] * 100 + '%'}
                          height="100%"
                          x={50 - (v[0] * 50) + '%'}
                          className="expressionValues--combined" />
                  }
                </>);
              case 'summary':
                return (<>
                  { v[0] !== UNKNOWN_EXPRESSION_VALUE &&
                    <rect width={v[0] * 50 + '%'}
                          height="100%"
                          x={(1 - (v[0] + v[1])/2) * 50 + '%'}
                          className="expressionValues--betaPos" />
                  }
                  { v[1] !== UNKNOWN_EXPRESSION_VALUE &&
                    <rect width={v[1] * 50 + '%'}
                          height="100%"
                          x={(1 - (v[0] + v[1])/2 + v[0]) * 50 + '%'}
                          className="expressionValues--betaNeg" />
                  }
                </>);
              default:
                return (<>
                  { v[0] !== UNKNOWN_EXPRESSION_VALUE &&
                    <rect width={v[0] * 50 + '%'}
                          height="100%"
                          x={50 - (v[0] * 50) + '%'}
                          className="expressionValues--rna" />
                  }
                  { v[1] !== UNKNOWN_EXPRESSION_VALUE &&
                    <rect width={v[1] * 50 + '%'}
                          height="100%"
                          x="50%"
                          className="expressionValues--protein" />
                  }
                </>);
              }
            }
          )()}
        </svg>
      </td>
    )
  }

}

class BinaryValue extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const value = this.props.value == true,
          className = `BinaryValue ${this.props.additionalClass} ${value ? ' empty' : ''}`;
    return (
      <td className={className}>{value &&
        <svg className="binaryTrue"
             viewBox="0 0 100 100">
          <circle cx="50%" 
                  cy="50%" 
                  r="50%"/>
        </svg>
      }</td>
    )
  }

}


// class DataCols extends React.Component {

//   constructor(props) {
//     super(props);
//   }

//   render() {
//     const columns = this.props.columns;

//     return (<>
//       {columns.map((cc, i) => {

//         const hasItems = 'items' in cc;

//         return (
//             <colgroup className={'colgroup--' + toClassName(cc.name) + (hasItems ? ' colgroup--multiCol' : ' colgroup--singleton')}
//                       key={cc.name}>
//               {(hasItems ? cc.items : [cc.name]).map((c, j) =>
//                 <col className={'col--' + toClassName(c)}
//                      key={cc.name + '-' + c} />
//             )}
//           </colgroup>
//         )
//       })}
//     </>);
//   }
// }