import { L } from "./ebacktesting.core.js";

L.addCss = function () {
    $("<style>")
        .prop("type", "text/css")
        .html(`
        .hidden {
            display: none !important;
        }
        .drag-handle {
            cursor: grab;
            margin-right: 10px;
            opacity: 0.3;
        }
        .drag-handle:hover {
            opacity: 1;
        }

        @media (any-hover: hover) {
            html.theme-dark .button:hover {
                color: var(--tv-color-toolbar-button-text-hover, #dbdbdb);
            }
            .button:hover {
                color: var(--tv-color-toolbar-button-text-hover, #0f0f0f);
            }
            html.theme-dark .button.isInteractive:hover:before {
                background-color: var(--tv-color-toolbar-button-background-hover, #2e2e2e);
            }
            .button.isInteractive:hover:before {
                background-color: var(--tv-color-toolbar-button-background-hover, #f2f2f2);
                content: "";
            }
        }
        .button.isInteractive:before {
            border-radius: var(--tv-toolbar-explicit-hover-border-radius, 2px);
            bottom: var(--tv-toolbar-explicit-hover-margin, 2px);
            display: block;
            left: var(--tv-toolbar-explicit-hover-margin, 2px);
            outline: 2px none #2962ff;
            position: absolute;
            right: var(--tv-toolbar-explicit-hover-margin, 2px);
            top: var(--tv-toolbar-explicit-hover-margin, 2px);
            z-index: -1;
        }
        .controls {
            display: flex;
            justify-content: center;
            position: absolute;
        }
        .controls-separator {
            display: flex;
            flex: 1;
            height: 38px;
            justify-content: center;
            margin: 0 4px;
            max-width: 41px;
            min-width: 9px;
        }
        .controls-control {
            align-items: center;
            display: flex;
            height: 38px;
            justify-content: center;
            min-width: 38px;
        }
        .controls-control-type-forward {
            flex: 2;
            max-width: 70px;
            min-width: 38px;
        }
        .skip-intervals {
            margin: 6px;
        }

        html.theme-dark .button {
            color: var(--tv-color-toolbar-button-text, #dbdbdb);
            border-color: #fff;
        }
        .button.isInteractive {
            position: relative;
            z-index: 0;
        }
        .controls-button {
            height: 38px;
            justify-content: center;
            width: 38px;
        }
        .button {
            all: unset;
            align-items: center;
            box-sizing: border-box;
            cursor: default;
            display: flex;
            height: 100%;
            transition: background-color 60ms ease, opacity 60ms ease, color 60ms ease;
            --tv-toolbar-explicit-hover-border-radius: 4px;
            color: var(--tv-color-toolbar-button-text, #0f0f0f);
            border-color: #0f0f0f;
        }
        html.theme-dark .separator {
            background-color: var(--tv-color-toolbar-divider-background, #4a4a4a);
        }
        .separator {
            background-color: var(--tv-color-toolbar-divider-background, #ebebeb);
            display: inline-block;
            height: calc(100% - 16px);
            margin: 8px 4px;
            width: 1px;
        }
        div[role="dialog"][data-name="source-properties-editor"][data-dialog-name] {
            overflow-y: auto;
        }
        .ebacktesting-positions-table input[type="number"]::-webkit-outer-spin-button,
        .ebacktesting-positions-table input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        .ebacktesting-positions-table input[type="number"] {
            -moz-appearance: textfield;
            text-align: right;
        }
        
        .ebacktesting-positions-table input, .ebacktesting-positions-table textarea {
            border: none;
            width: 100%;
            resize: none;
            outline: none;
            height: 100%;
            padding: 0;
            margin: 0;
        }

        .default {
            --ui-lib-icon-qi-default-color: #b8b8b8;
            --ui-lib-icon-qi-default-color-hover: #707070;
            --ui-lib-icon-qi-default-color-active: #4a4a4a;
        }
        html.theme-dark .default {
            --ui-lib-icon-qi-default-color-active: #b8b8b8;
            --ui-lib-icon-qi-default-color-hover: #8c8c8c;
            --ui-lib-icon-qi-default-color: #575757;
        }
        .iconWrapper {
            --ui-lib-size-defaulted: var(--ui-lib-size, 3);
            --ui-lib-size-defaulted-small: calc(max(0, 1 - (var(--ui-lib-size-defaulted) - 3) * (var(--ui-lib-size-defaulted) - 3)));
            --ui-lib-size-defaulted-medium: calc(max(0, 1 - (var(--ui-lib-size-defaulted) - 4) * (var(--ui-lib-size-defaulted) - 4)));
            --ui-lib-size-defaulted-large: calc(max(0, 1 - (var(--ui-lib-size-defaulted) - 5) * (var(--ui-lib-size-defaulted) - 5)));
            background: #0000;
            border: 0;
            box-shadow: none;
            color: var(--ui-lib-icon-qi-color, var(--ui-lib-icon-qi-default-color));
            display: inline-block;
            padding: 0;
            vertical-align: middle;
            --ui-lib-icon-question-information-size: calc(var(--ui-lib-size-defaulted-small)*18px + var(--ui-lib-size-defaulted-medium)*28px + var(--ui-lib-size-defaulted-large)*44px);
            height: var(--ui-lib-icon-question-information-size);
            line-height: var(--ui-lib-icon-question-information-size);
            min-width: var(--ui-lib-icon-question-information-size);
            outline: none;
            overflow: visible;
            position: relative;
            width: var(--ui-lib-icon-question-information-size);
        }
        @media (hover: hover) and (pointer: fine) {
            @media (any-hover: hover) {
                .icon-wrapper:hover {
                    color: var(--ui-lib-icon-qi-color-hover, var(--ui-lib-icon-qi-default-color-hover));
                }
            }
        }
        @media (any-hover: hover) {
            .icon-wrapper:hover {
                color: var(--ui-lib-icon-qi-color, var(--ui-lib-icon-qi-default-color));
            }
        }
        @media (any-hover: hover) {
            .iconWrapper:hover {
                color: var(--ui-lib-icon-qi-color-hover, var(--ui-lib-icon-qi-default-color-hover));
            }
        }
        .wrapper {
            height: 100%;
            position: relative;
            width: 100%;
            display: flex;
            flex-direction: column;
        }
        html.theme-dark .root{
            background-color: var(--report-table-background, #0f0f0f);
        }
        .table {
            --report-table-cell-height: 98px;
        }
        .root {
            background-color: var(--report-table-background, #fff);
            height: 100%;
            overflow: visible;
        }
        .tableWrapper {
            overflow-y: auto;
            width: auto;
        }
        html.theme-dark .headCell {
            background-color: var(--report-table-background, #0f0f0f);
            border-bottom: 1px solid var(--report-table-header-border, #4a4a4a);
            color: #8c8c8c;
        }
        .headCell:first-child {
            padding-left: 20px;
            text-align: left;
        }
        .root .ka-pointer {
            cursor: default;
        }
        .fitContent {
            width: 0;
        }
        .headCell {
            background-color: var(--report-table-background, #fff);
            border-bottom: 1px solid var(--report-table-header-border, #ebebeb);
            color: #707070;
            font-family: -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif;
            font-feature-settings: "tnum" on, "lnum" on;
            font-style: normal;
            height: 49px;
            padding: 0 12px;
            text-align: right;
            white-space: nowrap;
            z-index: 1;
            --ui-lib-typography-font-size: 14px;
            font-size: var(--ui-lib-typography-font-size);
            font-weight: 400;
            --ui-lib-typography-line-height: 18px;
            line-height: var(--ui-lib-typography-line-height);
        }
        .leftAlign {
            text-align: left !important;
        }
        .rightAlign {
            text-align: right !important;
        }
        .centerAlign {
            text-align: center !important;
        }
        html.theme-dark .row {
            border-bottom: 1px solid var(--report-table-border, #2e2e2e);
        }
        .row {
            border-bottom: 1px solid var(--report-table-border, #f2f2f2);
            border-top: none;
        }
        @media (any-hover: hover) {
            html.theme-dark .row:hover {
                background-color: rgb(46, 46, 46);
            }
            .row:hover {
                background-color: rgb(225, 225, 225);
            }
        }
        html.theme-dark .row.selected {
            background-color: rgb(26, 29, 53);
        }
        .row.selected {
            background-color: rgb(216, 219, 249);
        }
        html.theme-dark .cell {
            color: #dbdbdb;
        }
        .row td:first-child {
            text-align: left;
        }
        .cell:first-child {
            padding-left: 20px;
        }
        .row td {
            text-align: right;
        }
        .justifyStart {
            justify-content: flex-start;
        }
        .justifyEnd{
            justify-content: flex-end;
        }
        .noPadding {
            padding: 0 !important
        }
        .ka-thead-cell-wrapper {
            cursor: pointer;
        }
        .cell {
            color: #0f0f0f;
            font-family: -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif;
            font-feature-settings: "tnum" on, "lnum" on;
            font-style: normal;
            height: var(--report-table-cell-height, 49px);
            padding: 0 12px;
            -webkit-user-select: text;
            user-select: text;
            --ui-lib-typography-font-size: 14px;
            font-size: var(--ui-lib-typography-font-size);
            font-weight: 400;
            --ui-lib-typography-line-height: 18px;
            line-height: var(--ui-lib-typography-line-height);
            max-width: 240px;
        }
        .doubleCell {
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: inherit;
        }
        .doubleCell .cell:first-child {
            position: relative;
        }
        .doubleCell .cell {
            align-items: center;
            display: flex;
            height: 100%;
            justify-content: inherit;
            padding: 0 12px;
            -webkit-user-select: none;
            user-select: none;
            white-space: nowrap;
            max-width: unset;
        }
        .date-cell {
            cursor: pointer;
        }
        .date-cell:hover {
            color: #00b6ff !important;
        }
        .date-cell svg {
            position: fixed !important;
            left: 5px;
        }
        html.theme-dark .doubleCell .cell:first-child:after {
            border-bottom: 1px solid #4a4a4a;
        }
        .doubleCell .cell:first-child:after {
            border-bottom: 1px solid #ebebeb;
            bottom: 0;
            content: "";
            display: block;
            margin: 0 -12px;
            position: absolute;
            width: 100%;
        }
        .cell .V_VALUE {
            white-space: pre-wrap;
        }
        .square {
            border-radius: 4px;
        }
        .iconButton {
            align-items: center;
            background: none;
            border: none;
            display: flex;
            height: 22px;
            justify-content: center;
            outline: none;
            overflow: visible;
            padding: 0;
            position: relative;
            width: 22px;
        }
        html.theme-dark .primary .icon {
            color: var(--ui-lib-iconButton-icon-color-default, #8c8c8c);
        }
        .primary .icon {
            color: var(--ui-lib-iconButton-icon-color-default, #707070);
        }
        .blockIcon, .blockIcon svg {
            display: block;
        }
        html.theme-dark .openTrade {
            color: #8c8c8c;
        }
        .openTrade {
            color: #707070;
        }
        .twoRows {
            align-items: flex-end !important;
            flex-flow: column wrap !important;
        }
        .tableCell {
            align-items: baseline;
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            justify-content: flex-end;
        }
        .currencyWrapper {
            align-items: baseline;
            display: flex;
            gap: 3px;
        }
        .value {
            white-space: nowrap;
        }
        .currency {
            font-family: -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif;
            font-feature-settings: "tnum" on, "lnum" on;
            white-space: nowrap;
            --ui-lib-typography-line-height: 14px;
            line-height: var(--ui-lib-typography-line-height);
            --ui-lib-typography-font-size: 10px;
            font-size: var(--ui-lib-typography-font-size);
            font-style: normal;
            font-weight: 500;
        }
        .small {
            font-size: 12px !important;
            --ui-lib-size: 3;
        }
        .percentValue {
            font-size: var(--data-cell-percent-font-size, 14px);
            white-space: nowrap;
        }
        .percentValue div {
            display: inline-block;
        }
        .V_INDEX.openTrade {
            display: none;
        }

        .action-buttons {
            display: none;
        }
        .action-buttons .button {
            margin: 16px;
            cursor: pointer;
        }
        .action-buttons.openTrade {
            display: block;
        }

        .snapshot-action-buttons div {
            display: inline-block;
            margin-top: auto;
            margin-bottom: auto;
            vertical-align: middle;
            cursor: pointer;
        }
        .snapshot-action-buttons div svg {
            vertical-align: middle;
        }
        .snapshot-action-buttons div:hover {
            color: orange !important;
        }
        .view-snapshots-button[data-snapshots="0"] {
            display: none;
        }
        .snapshot-viewer {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            width: 100%;
            height: calc(100% - 60px);
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            text-align: center;
            color: white;
            padding-top: 60px;
            backdrop-filter: blur(20px);
            overflow-y: auto;
        }
        .snapshot-viewer-image-container {
            width: 100%;
            text-align: center;
            display: block;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28'%3E%3Cpath fill='white' d='M13.88 3.88a1.88 1.88 0 1 1-3.76 0 1.88 1.88 0 0 1 3.76 0ZM12 18.24A1.88 1.88 0 1 0 12 22a1.88 1.88 0 0 0 0-3.75Zm8.13-8.13a1.88 1.88 0 1 0 0 3.76 1.88 1.88 0 0 0 0-3.76ZM5.74 12A1.88 1.88 0 1 0 2 12a1.88 1.88 0 0 0 3.75 0Zm.5 3.87a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75Zm11.5 0a1.88 1.88 0 1 0 0 3.75 1.88 1.88 0 0 0 0-3.75ZM6.25 4.38a1.87 1.87 0 1 0 0 3.75 1.87 1.87 0 0 0 0-3.75Z'/%3E%3C/svg%3E");
            color: white;
            background-repeat: no-repeat;
            background-size: 150px;
            min-height: 150px;
            background-position: center;
        }
        .snapshot-viewer-image-container img {
            max-width: calc(100% - 70px);
            max-height: calc(100% - 70px);
            border: 1px solid white;
        }
        .snapshot-viewer-info {
            display: inline-block;
            margin: 5px;
            font-size: 1.3em;
            line-height: 1.5em;
        }
        .snapshot-viewer-url {
            color: #c2ffeb;
            font-size: 0.8em;
        }
        .snapshot-viewer-time {
            color:rgba(194, 255, 235, 0.72);
            font-size: 0.8em;
        }
        .snapshot-viewer-button {
            cursor: pointer !important;
            padding: 10px;
            margin: 10px;
            color: white !important;
        }
        .snapshot-viewer-close-button {
            float: right;
        }
        .snapshot-viewer-nav-button.snapshot-viewer-prev {
            float: left;
            height: 45px;
        }
        .snapshot-viewer-nav-button.snapshot-viewer-next {
            float: right;
            height: 45px;
        }
        .snapshot-viewer-delete-button {
            float: left;
        }

        .ebacktesting-session-balance, .ebacktesting-session-analysis-timer {
            white-space: nowrap;
            display: flex;
            align-items: center;
            box-sizing: border-box;
        }
        .ebacktesting-session-balance div {
            margin-left: 20px;
            margin-right: 20px;
        }
        .ebacktesting-session-balance-equity {
            display: none;
        }

        .ebacktesting-prompt-dialog {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .ebacktesting-prompt-dialog-content {
            padding: 20px;
            background: #131314;
            color: white;
            border: 2px solid white;
            border-radius: 6px;
            text-align: left;
        }
        .ebacktesting-prompt-dialog-content h3 {
            margin-bottom: 16px;
        }
        .ebacktesting-prompt-dialog-content input {
            border: 1px solid #6f6f6f;
            margin-bottom: 5px;
            width: 100%;
            text-align: left;
            padding-top: 3px;
            padding-bottom: 3px;
            background-color: #242425;
            color: white;
        }
        .ebacktesting-prompt-dialog-content div {
            display: block;
            width: 100%;
            text-align: right;
        }
        .ebacktesting-prompt-dialog-content button {
            margin-left: 5px;
            color: initial;
        }
        
        .ebacktesting-dialog-section-title {
            margin-bottom: 15px;
            grid-column: 1 / 3;
        }
        .ebacktesting-dialog-section-title + * {
            margin-bottom: 30px;
        }
        .ebacktesting-dialog-options-section {
            line-height: 2em;
            grid-column: 1 / -1;
        }
        .ebacktesting-dialog-options-section .iconWrapper {
            float: right;
        }
        .ebacktesting-dialog-table {
            grid-column: 1 / 3;
            line-height: 1em;
        }
        .ebacktesting-dialog-table tr {
            height: 34px;
        }
        .ebacktesting-dialog-table td.ebacktesting-actions {
            text-align: center;
            padding: 5px;
        }
        .ebacktesting-dialog-table td button[disabled] {
            opacity: 0.3;
        }
        .ebacktesting-dialog-table td.column-drag {
            text-align: left;
        }

        .ebacktesting-dialog-section-sessions .intro {
            display: block;
            max-width: 410px;
        }
        .ebacktesting-dialog-section-sessions .ebacktesting-loader {
            display: block;
            margin: 20px;
            margin-left: auto;
            margin-right: auto;
        }
        .ebacktesting-dialog-section-plan {
            margin-top: 20px;
            margin-bottom: 20px;
        }
        .ebacktesting-sessions-table {
            margin-bottom: 10px;
            margin-top: 20px;
        }
        .ebacktesting-sessions-table tr[data-session-id].selected-session {
            background-color: #0000ff1f;
        }
        .ebacktesting-sessions-table tr[data-session-id='new']{
            background-color: #6b8e2321;
        }
        .ebacktesting-sessions-table tr[data-session-id]>td {
            padding: 15px;
        }
        .ebacktesting-sessions-table td,
        .ebacktesting-sessions-table th {
            border: 1px solid #4a4a4a7a;
        }
        .ebacktesting-sessions-table tr[data-session-id] table td {
            border: none;
            text-align: right;
        }
        .ebacktesting-sessions-table tr[data-session-id] table tr td:first-child {
            width: 100px;
            text-align: left;
        }
        .ebacktesting-sessions-table tr[data-session-id] td input, .ebacktesting-sessions-table tr[data-session-id] td select {
            text-align: right;
            padding: 0;
            margin: 0;
            width: 100%;
        }
        .ebacktesting-sessions-table tr[data-session-id] td select::-ms-expand {
            display: none;
        }
        .ebacktesting-sessions-table tr[data-session-id] td.session-name input {
            float: right;
        }
        .ebacktesting-sessions-table input[type="number"]::-webkit-outer-spin-button,
        .ebacktesting-sessions-table input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        .ebacktesting-sessions-table input[type="number"] {
            display: inline-block;
            -moz-appearance: textfield;
            padding: 0;
            margin: 0;
        }
        .ebacktesting-sessions-table tr table td.session-stats-info {
            font-size: 0.8em;
            opacity: 0.8;
            font-style: italic;
        }
        .ebacktesting-sessions-table .ebacktesting-actions button {
            margin: 4px;
        }
        .ebacktesting-sessions-table td.session-capital table {
            width: 100%;
        }
        .ebacktesting-sessions-table td.session-capital td.session-capital-currency {
            width: 66px;
        }
        .ebacktesting-column-settings-table td.column-enable {
            text-align: center;
            width: 25px;
        }
        .ebacktesting-column-settings-table td.column-name {
            text-align: left;
            padding-right: 16px;
        }
        .ebacktesting-column-settings-table td.column-type {
            text-align: right;
        }
        .ebacktesting-column-settings-add-new-column-container {
            margin-top: 10px;
            margin-bottom: 20px;
            grid-column: 1 / 3;
        }
        .ebacktesting-dialog-section.predefined-times {
            grid-column: 1 / -1;
            display: grid;
        }
        .ebacktesting-dialog-section.predefined-times .ebacktesting-dialog-table {
            margin-top: 5px;
        }
        .ebacktesting-dialog-options-section-custom-date {
            grid-column: 1 / -1;
        }
        .ebacktesting-dialog-options-section hr,
        .ebacktesting-dialog-options-section-custom-date hr {
            margin-top: 20px;
            margin-bottom: 20px;
            opacity: 0.2;
        }
        .ebacktesting-dialog-options-section-custom-date .ebacktesting-dialog-table {
            margin-top: 5px;
        }
        .ebacktesting-dialog-options-section-custom-date .ebacktesting-dialog-section {
            display: grid
        }
        .discord-cta {
            max-width: 300px;
        }
        @media not (pointer: coarse) {
            @media (any-hover: hover) {
                html.theme-dark .secondary:hover {
                    --ui-lib-light-button-default-color-border: #2e2e2e;
                    --ui-lib-light-button-default-color-content: #fff;
                    --ui-lib-light-button-default-color-bg: #4b4b4b;
                }
            }
            html.theme-dark .secondary.active, html.theme-dark .secondary.disableActiveOnTouch:not(.disableActiveStateStyles):not(:disabled):active, html.theme-dark .secondary:not(.disableActiveOnTouch):not(.disableActiveStateStyles):not(:disabled):active {
                --ui-lib-light-button-default-color-border: #3d3d3d;
                --ui-lib-light-button-default-color-content: #fff;
                --ui-lib-light-button-default-color-bg: #3d3d3d;
            }
            .secondary.active, .secondary.disableActiveOnTouch:not(.disableActiveStateStyles):not(:disabled):active, .secondary:not(.disableActiveOnTouch):not(.disableActiveStateStyles):not(:disabled):active {
                --ui-lib-light-button-default-color-bg: #ebebeb;
                --ui-lib-light-button-default-color-content: #0f0f0f;
                --ui-lib-light-button-default-color-border: #ebebeb;
            }
        }
        html.theme-dark .secondary {
            --ui-lib-light-button-default-color-border: #4a4a4a;
            --ui-lib-light-button-default-color-content: #dbdbdb;
            --ui-lib-light-button-default-color-bg: #0000;
        }
        .secondary:hover {
            --ui-lib-light-button-default-color-bg: #000000c2;
            --ui-lib-light-button-default-color-content: #ffffff;
            --ui-lib-light-button-default-color-border: #3d3d3d;
        }
        .secondary {
            --ui-lib-light-button-default-color-bg: #0000;
            --ui-lib-light-button-default-color-content: #0f0f0f;
            --ui-lib-light-button-default-color-border: #575757;
        }
        .lightButton.typography-regular14px, .lightButton.typography-semibold14px {
            font-family: -apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif;
            --ui-lib-typography-font-size: 14px;
            --ui-lib-typography-line-height: 18px;
            line-height: var(--ui-lib-typography-line-height);
        }
        .lightButton.typography-regular14px {
            font-feature-settings: "tnum" on, "lnum" on;
            font-size: var(--ui-lib-typography-font-size);
            font-style: normal;
            font-weight: 400;
        }
        .xsmall {
            border-radius: 6px;
            height: 28px;
            min-width: 28px;
            padding-block-end: 0;
            padding-block-start: 0;
            padding-inline-end: 11px;
            padding-inline-start: 11px;
        }
        .lightButton {
            align-items: center;
            background-color: var(--ui-lib-light-button-color-bg, var(--ui-lib-light-button-default-color-bg));
            border-color: var(--ui-lib-light-button-color-border, var(--ui-lib-light-button-default-color-border));
            border-style: solid;
            border-width: 1px;
            box-sizing: border-box;
            color: var(--ui-lib-light-button-color-content, var(--ui-lib-light-button-default-color-content));
            cursor: default;
            display: inline-flex;
            justify-content: center;
            max-width: 100%;
            min-width: 40px;
            outline: none;
            overflow: visible;
            position: relative;
        }
        .xsmall .content {
            padding-bottom: calc((28px - var(--ui-lib-typography-line-height)) / 2 - 1px);
            padding-top: calc((28px - var(--ui-lib-typography-line-height)) / 2 - 1px);
        }
        .nowrap {
            align-self: auto;
            overflow: hidden;
            white-space: nowrap;
        }
        .content {
            display: inline-block;
            min-width: 0;
            text-align: center;
            --ui-lib-lightbutton-show-children-with-fallback: var(--ui-lib-lightButton-show-children, 1);
            max-width: calc(max(0, 1 -(var(--ui-lib-lightbutton-show-children-with-fallback) - 1)*(var(--ui-lib-lightbutton-show-children-with-fallback) - 1))* 9999px + max(0, 1 -(var(--ui-lib-lightbutton-show-children-with-fallback) - 0)*(var(--ui-lib-lightbutton-show-children-with-fallback) - 0))* 0px);
        }
        .ellipsisContainer {
            display: inherit;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .input {
            padding: 0 calc(8px - var(--ui-lib-control-border-width, 2px) - var(--ui-lib-control-inner-slot-gap, 2px));
        }
        input.size-small {
            background-color: rgba(255, 255, 255, 0.2);
        }
        input.size-small:read-only {
            background-color: rgba(255, 255, 255, 0.1);
        }
        html.theme-dark input.size-small {
            background-color: rgba(0, 0, 0, 0.2);
        }
        html.theme-dark input.size-small:read-only {
            background-color: rgba(0, 0, 0, 0.1);
        }
        .input.size-small {
            border: 1px solid #4a4a4a00;
            -webkit-appearance: auto;
            appearance: textfield;
            display: block;
            height: 100%;
            margin: 0;
            min-width: 0;
            outline: 0;
            width: 100%;
            -webkit-text-fill-color: var(--ui-lib-control-text-fill-color, currentColor);
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
            order: 0;
        }
        .input.size-small:hover, .input.size-small:active, .input.size-small:focus  {
            border: 1px solid #4a4a4aa3;
        }
        .input.size-small:read-only {
            border: none !important;
        }
        .input.normal {
            border: 1px solid #4a4a4a;
            height: 2em;
            display: unset;
            width: unset;
        }
        .ebacktesting-button {
            all: unset;
            align-items: center;
            box-sizing: border-box;
            cursor: default;
            display: flex;
            height: 100%;
            transition: background-color 60ms ease, opacity 60ms ease, color 60ms ease;
            --tv-toolbar-explicit-hover-border-radius: 6px;
            color: var(--tv-color-toolbar-button-text-hover,var(--color-toolbar-button-text-hover));
            padding: 0 10px 0 5px;
            position: relative;
            z-index: 0;
        }
        html.theme-dark .button.isInteractive.isActive {
            color: var(--tv-tool-widget-button-interactive-color, var(--tv-color-toolbar-button-text-active));
            --tv-color-toolbar-button-background-hover: var(--tv-tool-widget-button-interactive-background-color);
        }
        .button.isInteractive.isActive {
            color: var(--tv-tool-widget-button-interactive-color, var(--tv-color-toolbar-button-text-active));
            --tv-color-toolbar-button-background-hover: var(--tv-tool-widget-button-interactive-background-color);
            --tv-tool-widget-button-interactive-color: var(--tv-color-item-active-text, var(--color-content-secondary-inverse));
            --tv-tool-widget-button-interactive-background-color: var(--tv-color-toolbar-toggle-button-background-active, var(--color-container-fill-primary-neutral-extra-bold));
            --tv-tool-widget-button-interactive-background-hover-color: var(--tv-color-toolbar-toggle-button-background-active-hover, var(--color-container-fill-primary-neutral-bold));
        }
        .button.isInteractive.isActive:before {
            background-color: var(--tv-color-toolbar-button-background-hover);
            content: "";
        }
        .button.isInteractive:before {
            border-radius: var(--tv-toolbar-explicit-hover-border-radius, 2px);
            bottom: var(--tv-toolbar-explicit-hover-margin-bottom, var(--tv-toolbar-explicit-hover-margin, 2px));
            display: block;
            left: var(--tv-toolbar-explicit-hover-margin-left, var(--tv-toolbar-explicit-hover-margin, 2px));
            outline: var(--color-tv-blue-500) none 2px;
            position: absolute;
            right: var(--tv-toolbar-explicit-hover-margin-right, var(--tv-toolbar-explicit-hover-margin, 2px));
            top: var(--tv-toolbar-explicit-hover-margin-top, var(--tv-toolbar-explicit-hover-margin, 2px));
            z-index: -1;
        }
        #header-toolbar-ebacktesting .js-button-text {
            margin-left: 5px;
        }
    `)
        .appendTo("head");
}
