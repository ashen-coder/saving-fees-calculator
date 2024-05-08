// @ts-check
'use strict'

console.log('Script is OK! ༼ つ ◕_◕ ༽つ');

// Types
/** @typedef {import('./lib/chartjs/chart.js').Chart} Chart */
/** @typedef {Record<string, number>[]} ResultList */

const CRITICAL_ERROR_MESSAGE = "Please refresh the page and try again.";
const CALCULATION_FAILED_ERROR_MESSAGE = "Please check the input values are reasonable";
const ANNUAL_FEE_ERROR_MESSAGE = 'The annual fee must be less than the interest rate.'

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

/**
 * @param {number} num
 * @param {string} space
 * @returns {string}
 */
function currencyFormat(num, space = '&nbsp') {
    return `R${space}` + num.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

/** 
 * @param {number} interestRate
 * @param {number} compound
 * @returns {number}
 */
function getInterestPayRate(interestRate, compound) {
    const cc = compound / 12;
    const interest = interestRate / 100 / compound;
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
                1079402.8580704,
                1164745.0229034629,
                1256455.3383878646,
                1354992.922757485,
                1460849.2738141618,
                1574550.519025797,
                1696659.8203966396,
                1827779.944679028,
                1968556.010214018,
                2119678.4224548554,
                2281886.011045858,
                2455969.3822031356,
                2642774.501076602,
                2843206.5197688662,
                3058233.8677500677,
                3288892.6225430905,
                3536291.1797658494,
                3801615.2429112494,
                4086133.1546271495,
                4391201.592733414
            ],
            backgroundColor: colors.secondaryTransparent,
            borderColor: colors.secondaryTransparent,
            order: 1
        },
        {
            label: 'Investment B',
            data: [
                1058236.3848764545,
                1119762.9670769225,
                1184761.6390904083,
                1253424.1865850163,
                1325952.819752369,
                1402560.7329045604,
                1483472.693813725,
                1568925.6643622818,
                1659169.4541541513,
                1754467.4088235293,
                1855097.134868785,
                1961351.2629346673,
                2073538.2515665733,
                2191983.2335665347,
                2317028.907191915,
                2449036.474554896,
                2588386.6297041974,
                2735480.598999948,
                2890741.2365291584,
                3054614.1774526145
            ],
            backgroundColor: colors.primaryLightTransparent,
            borderColor: colors.primaryLightTransparent,
            order: 1
        },
        {
            label: 'Difference',
            data: [
                21166.473193945596,
                44982.05582654034,
                71693.6992974563,
                101568.73617246863,
                134896.4540617927,
                171989.78612123663,
                213187.12658291473,
                258854.2803167461,
                309386.5560598667,
                365211.01363132615,
                426788.87617707276,
                494618.11926846835,
                569236.2495100286,
                651223.2862023315,
                741204.9605581528,
                839856.1479881946,
                947904.550061652,
                1066134.6439113016,
                1195391.918097991,
                1336587.4152807994
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
})
