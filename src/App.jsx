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


/* Helper functions */
const toClassName = function toClassName(name) {
  return name.toString().replace(/\P{L}/ug, '_');
}

const getClassNames = function getClassNames(columnGroup, column) {
  // Get class names based on column group and column name.
  // The same class names are used for both body and header cells.
  return `colgroup--${toClassName(columnGroup)} col--${toClassName(column == null ? columnGroup : column)}`;
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
      CODING_GENE_TYPE = 'protein_coding',
      examplePhenotype = 'HYPOTHYROIDISM',
      exampleDataset = require('./data/Annotated Credible Sets for HYPOTHYROIDISM.json');


class App extends React.Component {

  constructor(props) {
    super(props);

    this.staticColumns = NON_ANNOTATION_COLS;
    
    this.state = {
      phenotype: examplePhenotype,
      dataset:   exampleDataset,
      columns:   this.extractColumns(exampleDataset),
      options: {
        useProportionalExpressions: true,
        showAnatomicalSystems: true,
        showOrgans: true,
        showPathways: true,
        showMousePhenotypes: true
      }
    }
  }

  componentDidMount() {
    this.setState(prevState => ({columns: this.extractColumns(prevState.dataset)}));
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

  extractColumns(dataset) {
    if (dataset.length < 1)
      throw new Error('Dataset is empty!');
    if (dataset[0].nearest_genes.length < 1)
      throw new Error('First credible set in dataset has no genes!');

    const d = dataset[0].nearest_genes[0],
          columns = [...this.staticColumns];
    for (const g in ANNOTATION_COLS)
      columns.push({
        name:  g,
        items: ANNOTATION_COLS[g](d)
      });
    return columns;
  }

  getAppClassNames() {
    let classNames = 'App';
    for (const k in this.state.options)
      classNames += ` option--${k}--${toClassName(this.state.options[k])}`;
    return classNames;
  }

  render() {

    const phenotype = this.state.phenotype,
          dataset =   this.state.dataset,
          columns =   this.state.columns,
          options =   this.state.options,
          geneCount = dataset.map(l => l.nearest_genes.length).reduce((p, c) => p + c),
          usePropEx = options.useProportionalExpressions,
          showAS =    options.showAnatomicalSystems,
          showOrg =   options.showOrgans,
          showPW =    options.showPathways,
          showMP =    options.showMousePhenotypes;

    return (
      <div className={this.getAppClassNames()}>
        <header className="App-header">
          <h1>Panomicon view for {phenotype}</h1>
          <section className="App-options">
            <p>Credible sets: {dataset.length} • Genes: {geneCount}</p>
            <form>
              <label>
              <input
                  name="useProportionalExpressions"
                  type="checkbox"
                  checked={usePropEx}
                  onChange={this.handleInputChange} />
                Use proportional expressions
              </label>
              <label>
                <input
                  name="showAnatomicalSystems"
                  type="checkbox"
                  checked={showAS}
                  onChange={this.handleInputChange} />
                {columns[2].name}
              </label>
              <label>
                <input
                  name="showOrgans"
                  type="checkbox"
                  checked={showOrg}
                  onChange={this.handleInputChange} />
                {columns[3].name}
              </label>
              <label>
                <input
                  name="showPathways"
                  type="checkbox"
                  checked={showPW}
                  onChange={this.handleInputChange} />
                {columns[4].name}
              </label>
              <label>
                <input
                  name="showMousePhenotypes"
                  type="checkbox"
                  checked={showMP}
                  onChange={this.handleInputChange} />
                {columns[5].name}
              </label>
            </form>
          </section>
        </header>
        <table className="DataTable">
          { // <DataCols columns={columns} 
          }
          <thead>
            <DataTHRows columns={columns} />
          </thead>
          <tbody>
            {dataset.map(cs => 
              <CredibleSet data={cs}
                           columns={columns}
                           useProportionalExpressions={usePropEx}
                           key={cs.locus} />
            )}
          </tbody>
        </table>
      </div>
    );
  }
}
export default App;

class DataTHRows extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const columns = this.props.columns;

    return (<>
      <tr className="thRow--level1">
        {columns.map((cg, i) =>
          <th colSpan={'items' in cg ? cg.items.length : 1}
              className={('items' in cg ? 'firstOfGroup ' : '') + getClassNames(cg.name)}
              key={i}><span>{cg.name}</span></th>
        )}
      </tr>
      <tr className="thRow--level2">
        {columns.map((cg, i) => 'items' in cg ?
                                cg.items.map((c, j) =>
                                  <th className={(j === 0 ? 'firstOfGroup ' : '') + getClassNames(cg.name, c.name)}
                                      key={i + '-' + j}><span>{c.name}</span></th>) : 
                                <th className="empty" key={i} />
          ).flat()}
      </tr>
    </>);
  }
}

class CredibleSet extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const columns   = this.props.columns,
          data      = this.props.data,
          rowSpan   = data.nearest_genes.length,
          pval      = NUM_FORMATS.pval.format(data.pval),
          beta      = NUM_FORMATS.beta.format(data.lead_beta),
          usePropEx = this.props.useProportionalExpressions;

    const csDetails = (<>
      <td className={'firstOfGroup ' + getClassNames(columns[0].name, columns[0].items[0].name)}
          rowSpan={rowSpan}>{data.locus}</td>
      <td className={getClassNames(columns[0].name, columns[0].items[1].name)}
          rowSpan={rowSpan}>{pval}</td>
      <td className={getClassNames(columns[0].name, columns[0].items[2].name)}
          rowSpan={rowSpan}>{beta}</td>
    </>);

    return data.nearest_genes.map((gene, i) =>
      <tr key={`${data.locus}-${gene.approved_symbol}`}
          className="credibleSet--{data.locus}">
        { i === 0 && csDetails }
        <Gene data={gene}
              columns={columns}
              useProportionalExpressions={usePropEx} />
      </tr>
    )
  }
}

class Gene extends React.Component {

  constructor(props) {
    super(props);
  }

  getItems(groupName, dataSource) {
    // ANNOTATION_COLS contains a getter for the group data
    return ANNOTATION_COLS[groupName](dataSource);
  }

  getValue(groupName, itemName, dataSource) {
    const items = this.getItems(groupName, dataSource);
    for (const item of items)
      if (item.name === itemName) return item.value;
  }

  getSum(groupName, valueKey, dataSource) {
    const  values = this.getItems(groupName, dataSource).map(i => valueKey === null ? i.value : i.value[valueKey]);
    return values.reduce((sum, item) => sum + item);
  }

  render() {
    const columns =    this.props.columns,
          annotCols =  columns.filter(c => c.name in ANNOTATION_COLS),
          data =       this.props.data,
          usePropEx =  this.props.useProportionalExpressions;
    let rnaScale, proteinScale;

    return (<>
      <td className={'firstOfGroup ' + getClassNames(columns[1].name, columns[1].items[0].name)}>
        {data.approved_symbol}
      </td>
      <BinaryValue value={data.biotype === CODING_GENE_TYPE}
                   additionalClass={getClassNames(columns[1].name, columns[1].items[1].name)} />
      {annotCols.map(cg => {

        if (['Anatomical systems', 'Organs'].includes(cg.name)) {
          rnaScale =     usePropEx ? this.getSum(cg.name, 'rna_value', data) : MAX_EXPRESSION_VALUES.rna;
          proteinScale = usePropEx ? this.getSum(cg.name, 'protein_level', data) : MAX_EXPRESSION_VALUES.protein;
        }

        return cg.items.map((c, i) => {
      
          const value = this.getValue(cg.name, c.name, data),
                key = `${cg.name}-${c.name}`,
                className = (i === 0 ? 'firstOfGroup ' : '') + getClassNames(cg.name, c.name);

          switch (cg.name) {
            case 'Anatomical systems':
            case 'Organs':
              value.rna_proportion     = (usePropEx ? value.rna_value : value.rna_level) / rnaScale;
              value.protein_proportion = value.protein_level / proteinScale;
              return <ExpressionValue value={value}
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

      }).flat()}
    </>);
  }
}

class ExpressionValue extends React.Component {

  constructor(props) {
    super(props);
  }

  render() {
    const v =                   this.props.value,
          valueRna =            v.rna_proportion,
          valueRnaUnknown =     v.rna_level === UNKNOWN_EXPRESSION_VALUE,
          valueProtein =        v.protein_proportion,
          valueProteinUnknown = v.protein_level === UNKNOWN_EXPRESSION_VALUE,
          className =           `ExpressionValue ${this.props.additionalClass}`;

    return (
      <td className={className}>
        <svg className="expressionValues"
             viewBox="0 0 100 100">
          { 
            !valueRnaUnknown &&
            <rect width={valueRna * 50 + '%'}
                  height="100%"
                  x={50 - (valueRna * 50) + '%'}
                  className="expressionValues-rna" />
          }
          { 
            !valueProteinUnknown &&
            <rect width={valueProtein * 50 + '%'}
                  height="100%"
                  x="50%" 
                  className="expressionValues-protein" />
          }
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