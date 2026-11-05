// ============================================================
// Belegungstabelle aus Google Sheets
// ============================================================

const SHEET_ID = "1TpL4K5azf7XJZzhjkSWnBzh40sGfJlGJw6Ev4WTy1mA";
const SHEET_GID = "0";
const SHEET_RANGE = "F9:I676";

// Explizites Tabellenblatt (gid=0) und Zellbereich F9:I676.
const SHEET_CSV_URL =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}&range=${SHEET_RANGE}`;

const searchInput = document.getElementById("occupancy-search");
const tableBody = document.getElementById("occupancy-table-body");
const statusElement = document.getElementById("occupancy-status");

let occupancyRows = [];


function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (insideQuotes && next === '"') {
                field += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            row.push(field);
            field = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") i++;
            row.push(field);
            if (row.some(value => value.trim() !== "")) rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    row.push(field);
    if (row.some(value => value.trim() !== "")) rows.push(row);
    return rows;
}


function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("de-DE")
        .replace(/[ä]/g, "a")
        .replace(/[ö]/g, "o")
        .replace(/[ü]/g, "u")
        .replace(/[ß]/g, "ss")
        .replace(/[^a-z0-9]/g, "");
}


function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle("error", isError);
}


function appendHighlightedText(cell, text, query) {
    const value = String(text ?? "");

    if (!query) {
        cell.textContent = value;
        return;
    }

    const lowerValue = value.toLocaleLowerCase("de-DE");
    const lowerQuery = query.toLocaleLowerCase("de-DE");
    let currentIndex = 0;
    let matchIndex = lowerValue.indexOf(lowerQuery, currentIndex);

    while (matchIndex !== -1) {
        cell.appendChild(document.createTextNode(value.slice(currentIndex, matchIndex)));

        const mark = document.createElement("mark");
        mark.textContent = value.slice(matchIndex, matchIndex + query.length);
        cell.appendChild(mark);

        currentIndex = matchIndex + query.length;
        matchIndex = lowerValue.indexOf(lowerQuery, currentIndex);
    }

    cell.appendChild(document.createTextNode(value.slice(currentIndex)));
}


function renderTable() {
    const query = searchInput.value.trim();
    const normalizedQuery = query.toLocaleLowerCase("de-DE");

    const filteredRows = occupancyRows.filter(row =>
        row.some(value =>
            String(value).toLocaleLowerCase("de-DE").includes(normalizedQuery)
        )
    );

    tableBody.replaceChildren();

    if (filteredRows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "placeholder";
        td.textContent = query
            ? "Keine passenden Einträge gefunden."
            : "Keine Belegungsdaten vorhanden.";
        tr.appendChild(td);
        tableBody.appendChild(tr);
    } else {
        for (const row of filteredRows) {
            const tr = document.createElement("tr");

            for (let column = 0; column < 4; column++) {
                const td = document.createElement("td");
                appendHighlightedText(td, row[column] ?? "", query);
                tr.appendChild(td);
            }

            tableBody.appendChild(tr);
        }
    }

    const countText = query
        ? `${filteredRows.length} von ${occupancyRows.length} Einträgen gefunden`
        : `${occupancyRows.length} Einträge geladen`;
    setStatus(countText);
}


function isHeaderRow(row) {
    const knownHeaders = new Set([
        "name", "personenname",
        "grabnummer", "grabnr", "grab",
        "aktennummer", "aktennr", "akte",
        "reserviert", "reservierung", "reservation"
    ]);
    return row.some(value => knownHeaders.has(normalizeHeader(value)));
}


async function loadOccupancyData() {
    setStatus("Lade Belegungsdaten ...");

    try {
        const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Google Sheets antwortet mit HTTP ${response.status}.`);
        }

        const csvText = (await response.text()).replace(/^\uFEFF/, "");
        const preview = csvText.slice(0, 350).replace(/\s+/g, " ").trim();

        if (/^\s*<(!doctype|html)[\s>]/i.test(csvText)) {
            throw new Error(
                "Google liefert eine HTML-Seite statt CSV. Prüfe die Freigabe „Jeder mit dem Link – Betrachter“."
            );
        }

        const csvRows = parseCSV(csvText);

        if (csvRows.length === 0) {
            throw new Error("Google hat eine leere CSV-Datei zurückgegeben.");
        }

        // F9 kann eine Kopfzeile oder bereits der erste Datensatz sein.
        const hasHeader = isHeaderRow(csvRows[0]);
        const headers = hasHeader ? csvRows[0] : [];
        const dataRows = hasHeader ? csvRows.slice(1) : csvRows;

        const normalizedHeaders = headers.map(normalizeHeader);
        const findIndex = (names, fallback) => {
            const found = normalizedHeaders.findIndex(header => names.includes(header));
            return found >= 0 ? found : fallback;
        };

        const nameIndex = hasHeader
            ? findIndex(["name", "personenname"], 0) : 0;
        const graveIndex = hasHeader
            ? findIndex(["grabnummer", "grabnr", "grab"], 1) : 1;
        const fileIndex = hasHeader
            ? findIndex(["aktennummer", "aktennr", "akte"], 2) : 2;
        const reservedIndex = hasHeader
            ? findIndex(["reserviert", "reservierung", "reservation"], 3) : 3;

        occupancyRows = dataRows
            .map(row => [
                row[nameIndex] ?? "",
                row[graveIndex] ?? "",
                row[fileIndex] ?? "",
                row[reservedIndex] ?? ""
            ])
            .filter(row => row.some(value => String(value).trim() !== ""));

        if (occupancyRows.length === 0) {
            throw new Error(
                `CSV wurde erreicht, enthält im Bereich ${SHEET_RANGE} aber keine Belegungszeilen. ` +
                `Antwortbeginn: ${preview || "(leer)"}`
            );
        }

        renderTable();
    } catch (error) {
        console.error("Belegungsdaten konnten nicht geladen werden:", error);

        tableBody.replaceChildren();
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "placeholder";
        td.textContent = "Belegungsdaten konnten nicht geladen werden.";
        tr.appendChild(td);
        tableBody.appendChild(tr);

        setStatus(error.message, true);
    }
}


searchInput.addEventListener("input", renderTable);
loadOccupancyData();
