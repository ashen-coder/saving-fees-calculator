// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/** @typedef {Record<string, number>[]} ResultList */

const CRITICAL_ERROR_MESSAGE = "Please refresh the page and try again.";
const CALCULATION_FAILED_ERROR_MESSAGE = "Please check the input values are reasonable";
const ANNUAL_FEE_ERROR_MESSAGE = 'The annual fee must be less than the interest rate.'

let currencySymbol = 'R';
let showCurrencyDecimals = true;

/** @param {Event} event */
function forceNumeric(event) {
    const element = /** @type {?HTMLInputElement} */ (event.target);
    if (!element) return;
    element.value = element.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*?)\..*/g, '$1');
}

/**
 * @param {number} num
 * @param {number} decimals
 * @returns {number}
 */
function roundDown(num, decimals = 0) {
    const exp = Math.pow(10, decimals);
    return Math.floor(num * exp) / exp;
}

/**
 * @param {number} num
 * @param {number} decimals
 * @returns {number}
 */
function roundUp(num, decimals = 0) {
    const exp = Math.pow(10, decimals);
    return Math.ceil(num * exp) / exp;
}

/** @param {string} value */
function getCurrencySymbol(value) {
    switch (value) {
        case 'USD':
            return '$';
        case 'EUR':
            return '€';
        case 'GBP':
            return '£';
        case 'JPY':
            return '¥';
        case 'CHF':
            return 'CHF';
        case 'CAD':
            return 'C$';
        case 'AUD':
            return 'A$';
        case 'CNY':
            return '¥';
        case 'INR':
            return '₹';
        case 'AED':
            return 'AED';
        case 'ZAR':
        default:
            return 'R';
    }
}

/**
 * @param {number} num
 * @param {string} space
 * @returns {string}
 */
function currencyFormat(num, space = '&nbsp') {
    return `${currencySymbol}${space}` + num.toFixed(showCurrencyDecimals ? 2 : 0).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

/** 
 * @param {number} interestRate
 * @param {number} compound
 * @returns {number}
 */
function getInterestPayRate(interestRate, compound) {
    const cc = compound / 12;
    const interest = Math.pow(1 + (interestRate / 100), 1 / compound) - 1;;
    return Math.pow(1 + interest, cc) - 1;
}

/**
 * @param {ResultList} monthlyResults 
 * @returns {ResultList}
 */
function getAnnualResults(monthlyResults) {
    const annualResults = [];

    monthlyResults.forEach((item, index) => {
        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            annualResults.push({
                endBalance: item.endBalance,
            });
        }
    });

    return annualResults;
}

/**
 * @param {ResultList} results1 
 * @param {ResultList} results2 
 * @returns {ResultList}
 */
function getDifference(results1, results2) {
    return results1.map((it, idx) => {
        const endBalance2 = results2[idx].endBalance;
        return {
            endBalance1: it.endBalance,
            endBalance2,
            difference: Math.abs(it.endBalance - endBalance2)
        }
    });
}

/**
 * @param {number} principal
 * @param {number} investmentTerm
 * @param {number} interestRate
 * @param {number} compound
 * @param {number} initialContribution
 * @param {number} annualIncrease
 * @param {number} annualFee
 */
function calculateMonthlyResults(
    principal,
    investmentTerm,
    interestRate,
    compound,
    initialContribution,
    annualIncrease,
    annualFee
) {
    const rateIncFee = getInterestPayRate(interestRate - annualFee, compound);
    const months = Math.max(investmentTerm * 12, 1);
    const results = [];

    let contribution = initialContribution;
    let balance = principal;
    for (let i = 1; i <= months; i++) {
        const startBalance = balance;

        balance += contribution;

        const interestPayment = balance * rateIncFee;
        balance += interestPayment;

        results.push({
            startBalance,
            endBalance: balance,
            interestPayment,
            contributionAmount: contribution
        });

        if (annualIncrease && i % 12 === 0) {
            contribution *= 1 + annualIncrease / 100;
        }
    }

    return results;
}

const customDataLabels = {
    id: 'customDataLabel',
    afterDatasetDraw(chart, args, pluginOptions) {
        const {
            ctx,
            data
        } = chart;
        ctx.save();

        data.datasets[0].data.forEach((datapoint, index) => {
            const { x, y } = chart.getDatasetMeta(0).data[index].tooltipPosition();

            ctx.textAlign = 'center';
            ctx.font = '14px Inter';
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            let toolTipText = datapoint != '0' ? datapoint + '%' : '';
            ctx.fillText(toolTipText, x, y);
        });
    },
};

const TRANSPARENCY = '0.5';

const colors = {
    primary: '#162953',
    primaryLight: '#25468d',
    secondary: '#00ABD0',
    secondaryTransparent: `rgba(0, 171, 208, ${TRANSPARENCY})`,
    primaryLightTransparent: `rgba(37, 70, 141, ${TRANSPARENCY})`,
    primaryTransparent: `rgba(22, 41, 83, ${TRANSPARENCY})`,
};

const tooltip = {
    enabled: false,
    itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
    external: function (context) {
        let tooltipEl = document.getElementById('chartjs-tooltip');

        // Create element on first render
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'chartjs-tooltip';
            tooltipEl.innerHTML = '<table></table>';
            document.body.appendChild(tooltipEl);
        }

        // Hide if no tooltip
        const tooltipModel = context.tooltip;
        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        // Set caret Position
        tooltipEl.classList.remove('above', 'below', 'no-transform');
        if (tooltipModel.yAlign) {
            tooltipEl.classList.add(tooltipModel.yAlign);
        } else {
            tooltipEl.classList.add('no-transform');
        }

        function getBody(bodyItem) {
            return bodyItem.lines;
        }

        if (tooltipModel.body) {
            const bodyLines = tooltipModel.body.map(getBody);

            let innerHtml = '<thead>';

            let year = +(Number(tooltipModel.title) * 12).toFixed(0);
            let months = +(year % 12).toFixed(0);
            let yearText = `Year ${(year - months) / 12}`;
            let monthText = months === 0 ? '' : `, Month ${months}`;
            innerHtml += '<tr><th class="loan-chart__title">' + yearText + monthText + '</th></tr>';

            innerHtml += '</thead><tbody>';
            bodyLines.forEach(function (body, i) {
                innerHtml += '<tr><td class="loan-chart__text">' + body + '</td></tr>';
            });
            innerHtml += '</tbody>';

            const tableRoot = tooltipEl.querySelector('table');
            if (tableRoot) {
                tableRoot.innerHTML = innerHtml;
            }
        }

        const position = context.chart.canvas.getBoundingClientRect();

        // Display, position, and set styles for font
        tooltipEl.style.opacity = '1';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.left = position.left + window.scrollX + tooltipModel.caretX - tooltipEl.clientWidth / 2 + 'px';
        tooltipEl.style.top = position.top + window.scrollY + tooltipModel.caretY - tooltipEl.clientHeight / 2 + 'px';
        tooltipEl.classList.add('loan-chart');
    },
};

const secondaryChartData = [
    {
        data: [10, 60, 30],
        backgroundColor: [colors.primary, colors.primaryLight, colors.secondary],
        borderColor: colors.primary,
        borderWidth: 0.5,
    },
];

const primaryChartData = {
    labels: [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20
    ],
    datasets: [
        {
            label: 'Investment A',
            data: [
                1077418.4353346988,
                1160489.9907328875,
                1249613.1650870303,
                1345213.9120220179,
                1447747.502067997,
                1557700.5097551905,
                1675592.9339446924,
                1801980.4602592797,
                1937456.8750647253,
                2082656.6410769555,
                2238257.645336633,
                2404984.1310026743,
                2583609.8251729636,
                2774961.2757470747,
                2979921.4112054007,
                3199433.3380952515,
                3434504.3919910206,
                3686210.458735992,
                3955700.583882666,
                4244201.889430317
            ],
            backgroundColor: colors.secondaryTransparent,
            borderColor: colors.secondaryTransparent,
            order: 1
        },
        {
            label: 'Investment B',
            data: [
                1057290.5330593896,
                1117773.6667594211,
                1181623.794461572,
                1249024.6935452183,
                1320170.0245042744,
                1395263.8563439618,
                1474521.2196532865,
                1558168.688800221,
                1646444.994771895,
                1739601.6702610792,
                1837903.7286834973,
                1941630.3788979577,
                2051075.7774932552,
                2166549.8206025837,
                2288378.9773079427,
                2416907.16680395,
                2552496.681603138,
                2695529.1591829383,
                2846406.604599215,
                3005552.466721877
            ],
            backgroundColor: colors.primaryLightTransparent,
            borderColor: colors.primaryLightTransparent,
            order: 1
        },
        {
            label: 'Difference',
            data: [
                20127.9022753092,
                42716.32397346641,
                67989.37062545819,
                96189.21847679955,
                127577.47756372252,
                162436.65341122868,
                201071.71429140586,
                243811.77145905863,
                291011.8802928303,
                343054.97081587627,
                400353.9166531358,
                463353.7521047166,
                532534.0476797083,
                608411.455144491,
                691542.433897458,
                782526.1712913015,
                882007.7103878828,
                990681.2995530539,
                1109293.979283451,
                1238649.42270844
            ],
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            type: 'line',
            order: 0
        }
    ],
};

const $errorBox = /** @type {HTMLElement} */ (document.getElementById('error-box'));
const $errorList = /** @type {HTMLElement} */ (document.getElementById('error-list'));
const $annualResultsTable = /** @type {HTMLElement} */ (document.getElementById('annual-results'));
const $monthlyResultsTable = /** @type {HTMLElement} */ (document.getElementById('monthly-results'));
const $monthlyFigures = /** @type {HTMLElement} */ (document.getElementById('monthly-figures'));

const $primaryChart = /** @type {HTMLCanvasElement} */ (document.getElementById('primary-chart'));
const $calculateBtn = /** @type {HTMLButtonElement} */ (document.getElementById('calculate-btn'));
const $showMonthlyFigures = /** @type {HTMLInputElement} */ (document.getElementById('show-monthly-figures'));

const $principal = /** @type {HTMLElement} */ (document.getElementById('principal'));
const $investmentTerm = /** @type {HTMLElement} */ (document.getElementById('investment-term'));
const $interestRate = /** @type {HTMLElement} */ (document.getElementById('interest-rate'));
const $monthlyContribution = /** @type {HTMLElement} */ (document.getElementById('monthly-contribution'));
const $annualIncrease = /** @type {HTMLElement} */ (document.getElementById('annual-increase'));
const $annualFee1 = /** @type {HTMLElement} */ (document.getElementById('annual-fee-1'));
const $annualFee2 = /** @type {HTMLElement} */ (document.getElementById('annual-fee-2'));

const $resultA = /** @type {HTMLElement} */ (document.getElementById('result-A'));
const $resultB = /** @type {HTMLElement} */ (document.getElementById('result-B'));
const $resultC = /** @type {HTMLElement} */ (document.getElementById('result-C'));

const $currency = /** @type {HTMLSelectElement} */ (document.getElementById('currency'));

const input = {
    value: /** @type {*} */ (null),
    elementId: "",
    shown: false,
    processed: false,
    silent: false,
    reset: function () {
        this.shown = false;
        $errorBox.classList.remove('calculator-result--error-active');
        document.querySelectorAll('.input-field--error')?.forEach(el => el.classList.remove('input-field--error'))
        document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.remove('calculator-result--hidden'))
    },
    error: function (inputId, message = `Incorrect value for "${inputId}"`, last = false) {
        if (this.silent) return;
        if (this.processed) this.reset();
        if (!Array.isArray(inputId)) inputId = [inputId];
        for (const inputIdItem of inputId) {
            const wrapperElement = /** @type {?HTMLElement} */ (document.getElementById(inputIdItem)?.parentNode);
            wrapperElement?.classList.add('input-field--error');
        }
        if (!this.shown) {
            this.processed = false;
            this.shown = true;
            $errorList.innerHTML = '';
            $errorBox.classList.add('calculator-result--error-active');
            document.querySelectorAll('.calculator-result:not(.calculator-result--error)').forEach(el => el.classList.add('calculator-result--hidden'))
        }
        const element = document.createElement('p');
        element.classList.add('calculator-error__item');
        element.innerHTML = message;
        $errorList.append(element);
        if (last) this.processed = true;
    },
    valid: function () {
        if (!this.shown || this.processed) this.reset();
        this.processed = true;
        this.silent = false;
        return !this.shown;
    },
    get: function (elementId) {
        this.elementId = elementId;
        let element = /** @type {HTMLInputElement} */ (document.getElementById(elementId));
        this.silent = false;
        if (element == null) {
            this.value = null;
        } else {
            this.value = element.value;
        }
        return this;
    },
    index: function () {
        const element = /** @type {?HTMLSelectElement} */ (document.getElementById(this.elementId));
        this.value = element?.selectedIndex;
        return this;
    },
    checked: function (elementId) {
        const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId))
        this.value = element?.checked;
        return this;
    },
    split: function (separator) {
        this.value = this.value.split(separator);
        return this;
    },
    replace: function (pattern, replacement) {
        this.value = this.value.replace(pattern, replacement);
        return this;
    },
    default: function (value) {
        if (!this.value) this.value = value;
        return this;
    },
    optional: function (value) {
        if (!this.value) this.silent = true;
        return this;
    },
    gt: function (compare = 0, errorText = `The ${this.elementId} must be greater than ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) <= compare) this.error(this.elementId, errorText);
        return this;
    },
    gte: function (compare = 0, errorText = `The ${this.elementId} must be greater than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) < compare) this.error(this.elementId, errorText);
        return this;
    },
    /** @param {number | string} compare */
    lt: function (compare = 0, errorText = `The ${this.elementId} must be less than ${compare}.`) {
        if (typeof compare !== 'number') {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(compare));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) >= compare) this.error(this.elementId, errorText);
        return this;
    },
    lte: function (compare = 0, errorText = `The ${this.elementId} must be less than or equal to ${compare}.`) {
        if (isNaN(compare)) {
            const element = /** @type {?HTMLInputElement} */ (document.getElementById(this.elementId));
            compare = Number(element?.value);
        }
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else if (Number(this.value) > compare) this.error(this.elementId, errorText);
        return this;
    },
    integer: function (errorText = `The ${this.elementId
        } must be integer number (-3, -2, -1, 0, 1, 2, 3, ...).`) {
        if (!this.value.match(/^-?(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    _naturalRegexp: /^([1-9]\d*)$/,
    natural: function (errorText = `The ${this.elementId} must be a natural number(1, 2, 3, ...).`) {
        if (!this.value.match(this._naturalRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    natural_numbers: function (errorText = `The ${this.elementId} must be a set of natural numbers(1, 2, 3, ...).`) {
        this.split(/[ ,]+/);
        if (!this.value.every(value => value.match(this._naturalRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    _mixedRegexp: /^(0|-?[1-9]\d*|-?[1-9]\d*\/[1-9]\d*|-?[1-9]\d*\s[1-9]\d*\/[1-9]\d*)$/,
    mixed: function (errorText = `The ${this.elementId} must be an integer / fraction / mixed number(1, 2 / 3, 4 5 / 6, ...).`) {
        if (!this.value.match(this._mixedRegexp)) this.error(this.elementId, errorText);
        return this;
    },
    mixed_numbers: function (errorText = `The ${this.elementId} must be a set of integer / fraction / mixed numbers(1, 2 / 3, 4 5 / 6, ...).`) {
        this.split(/,\s*/);
        if (!this.value.every(value => value.match(this._mixedRegexp))) this.error(this.elementId, errorText);
        return this;
    },
    number: function (errorText = `The "${this.elementId}" must be a number.`) {
        if (this.value === '' || isNaN(Number(this.value))) this.error(this.elementId, errorText);
        return this;
    },
    probability: function (errorText = `The "${this.elementId}" must be a number between 0 and 1.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 1)
            this.error(this.elementId, errorText);
        return this;
    },
    percentage: function (errorText = `The "${this.elementId}" must be a number between 0 and 100.`) {
        if (this.value === '' || isNaN(Number(this.value)) || Number(this.value) < 0 || Number(this.value) > 100)
            this.error(this.elementId, errorText);
        return this;
    },
    numbers: function (errorText = `The ${this.elementId} must be a set of numbers.`) {
        if (this.value.filter(value => isNaN(Number(value))).length) this.error(this.elementId, errorText);
        return this;
    },
    whole: function (errorText = `The ${this.elementId} must be a whole number.`) {
        if (!this.value.match(/^(0|[1-9]\d*)$/)) this.error(this.elementId, errorText);
        return this;
    },
    positive: function (errorText = `The ${this.elementId} must be greater than 0.`) {
        this.gt(0, errorText);
        return this;
    },
    nonZero: function (errorText = `The ${this.elementId} must be non - zero.`) {
        if (this.value === '' || isNaN(Number(this.value)))
            this.error(this.elementId, `The ${this.elementId} must be a number.`);
        else
            if (Number(this.value) == 0) this.error(this.elementId, errorText);
        return this;
    },
    nonNegative: function (errorText = `The ${this.elementId} must be greater than or equal to 0.`) {
        this.gte(0, errorText);
        return this;
    },
    negative: function (errorText = `The ${this.elementId} must be less than 0.`) {
        this.lt(0, errorText);
        return this;
    },
    bool: function () {
        return !!this.value;
    },
    val: function () {
        if (this.value === '' || this.value === null) return null;
        return Number(this.value);
    },
    vals: function () {
        return this.value.map(value => Number(value));
    },
    raw: function () {
        return this.value;
    }
}

/** @param {ResultList} results */
const displayResultSummary = (results) => {
    const finalResult = results[results.length - 1];
    $resultA.innerHTML = `Investment A: ${currencyFormat(finalResult.endBalance1)}`;
    $resultB.innerHTML = `Investment B: ${currencyFormat(finalResult.endBalance2)}`;
    $resultC.innerHTML = `Difference in Investment A vs B: ${currencyFormat(finalResult.difference)}`;
}

/** @param {ResultList} annualResults */
const displayAnnualResultsTable = (annualResults) => {
    let annualResultsHtml = '';

    annualResults.forEach((r, index) => {
        annualResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(r.endBalance1)}</td>
            <td>${currencyFormat(r.endBalance2)}</td>
            <td>${currencyFormat(r.difference)}</td>
        </tr>`;
    });

    $annualResultsTable.innerHTML = annualResultsHtml;
}

/** @param {ResultList} monthlyResults */
const displayMonthlyResultsTable = (monthlyResults) => {
    let monthlyResultsHtml = '';

    monthlyResults.forEach((item, index) => {
        monthlyResultsHtml += `<tr>
            <td class="text-center">${index + 1}</td>
            <td>${currencyFormat(item.endBalance1)}</td>
            <td>${currencyFormat(item.endBalance2)}</td>
            <td>${currencyFormat(item.difference)}</td>
        </tr>`;

        if ((index + 1) % 12 === 0 || (index + 1) === monthlyResults.length) {
            const year = Math.ceil((index + 1) / 12);
            const title = `Year #${year} End`;
            monthlyResultsHtml += `<th class="white text-center" colspan="6">${title}</th>`;
        }
    });

    $monthlyResultsTable.innerHTML = monthlyResultsHtml;
}

/**
 * @param {ResultList} annualResults
 * @param {Chart} primaryChart
 */
const displayPrimaryResultsChart = (annualResults, primaryChart) => {
    primaryChart.data.labels = annualResults.map((_, idx) => idx + 1);
    primaryChart.data.datasets[0].data = annualResults.map(it => it.endBalance1);
    primaryChart.data.datasets[1].data = annualResults.map(it => it.endBalance2);
    primaryChart.data.datasets[2].data = annualResults.map(it => it.difference);

    primaryChart.reset();
    primaryChart.update();
}

const getInputs = () => {
    input.reset();

    const principal = input.get($principal.id).val();
    const investmentTerm = input.get($investmentTerm.id).val();
    const interestRate = input.get($interestRate.id).val();
    const monthlyContribution = input.get($monthlyContribution.id).val();
    const annualIncrease = input.get($annualIncrease.id).val();
    const annualFee1 = input.get($annualFee1.id).lt($interestRate.id, ANNUAL_FEE_ERROR_MESSAGE).val();
    const annualFee2 = input.get($annualFee2.id).lt($interestRate.id, ANNUAL_FEE_ERROR_MESSAGE).val();

    const compound = 12;

    if (!input.valid()) {
        throw new Error("Invalid input");
    }

    if (
        principal === null ||
        investmentTerm === null ||
        interestRate === null ||
        annualIncrease === null ||
        monthlyContribution === null ||
        annualFee1 === null ||
        annualFee2 === null
    ) {
        input.error([], CRITICAL_ERROR_MESSAGE, true);
        throw new Error("Invalid state");
    }

    return {
        principal,
        investmentTerm,
        interestRate,
        compound,
        monthlyContribution,
        annualIncrease,
        annualFee1,
        annualFee2
    };
}

/**
 * @param {Chart} primaryChart
 */
const runApp = (primaryChart) => {
    const {
        principal,
        investmentTerm,
        interestRate,
        compound,
        monthlyContribution,
        annualIncrease,
        annualFee1,
        annualFee2
    } = getInputs();

    const monthlyResults1 = calculateMonthlyResults(
        principal,
        investmentTerm,
        interestRate,
        compound,
        monthlyContribution,
        annualIncrease,
        annualFee1
    );

    const monthlyResults2 = calculateMonthlyResults(
        principal,
        investmentTerm,
        interestRate,
        compound,
        monthlyContribution,
        annualIncrease,
        annualFee2
    );

    const annualResults1 = getAnnualResults(monthlyResults1);
    const annualResults2 = getAnnualResults(monthlyResults2);

    const monthlyResults = getDifference(monthlyResults1, monthlyResults2);
    const annualResults = getDifference(annualResults1, annualResults2);

    displayResultSummary(annualResults);
    displayMonthlyResultsTable(monthlyResults);
    displayAnnualResultsTable(annualResults);
    displayPrimaryResultsChart(annualResults, primaryChart);
}

/**
 * @param {Chart} primaryChart
 */
const changeCurrency = (primaryChart) => {
    currencySymbol = getCurrencySymbol($currency.value);
    showCurrencyDecimals = $currency.value !== 'JPY';
    document.querySelectorAll('.input-field__currency').forEach(el => el.textContent = currencySymbol);
    runApp(primaryChart);
};

[
    $principal,
    $investmentTerm,
    $interestRate,
    $monthlyContribution,
    $annualFee1,
    $annualFee2,
].forEach(input => input?.addEventListener('input', forceNumeric));

$showMonthlyFigures.addEventListener('change', () => {
    if ($showMonthlyFigures.checked) {
        $monthlyFigures.classList.remove('hidden');
    } else {
        $monthlyFigures.classList.add('hidden');
    }
});


import("./lib/chartjs/chart.js").then(({ Chart, registerables }) => {
    Chart.register(...registerables);

    const primaryChart = new Chart($primaryChart, {
        type: 'bar',
        data: primaryChartData,
        options: {
            response: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: tooltip,
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    ticks: {
                        callback: (it) => currencyFormat(it, ' '),
                    },
                },
                x: {
                    ticks: {
                        callback: function (value, index, ticks) {
                            return value + 1;
                        }
                    },
                    grid: {
                        display: false
                    },
                },
            },
        }
    });

    $calculateBtn.addEventListener('click', () => runApp(primaryChart));
    $currency.addEventListener('change', () => changeCurrency(primaryChart));
})
