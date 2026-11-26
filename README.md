# Staff Leave Gantt

A static site for tracking staff leave. No build step and no server, so it runs as-is on GitHub Pages.

- **`index.html`, the Leave page.** It has three views: **On leave today** (with each person's return date), **Pending approval** (with a one-tap Approve button) and **All leave** (with a date-range filter). Tap **+** to open the entry form, which has a Save button. Typing an employee number or name fills in the rest. Tap any leave to edit or delete it.
- **`data.html`, Data tools (⚙).** Import from Excel, download a CSV backup, download `data.js` to publish, and reset this device.
- **`holidays.html`, the Holidays page.** Lists the company-wide public holidays for 2026 and 2027.
- **`gantt.html`, the Gantt chart.** It has a search box, a department dropdown and a period dropdown with ‹ › arrows to step through months, quarters or years. Rows are grouped by department, and the chart only shows people who are on leave in the chosen period, with a per-day count of how many are away.

## Where the data lives

- `data.js` holds the starting data and the 2026–2027 public holidays.
- Entries saved on the Leave page are stored in **your own browser** (localStorage). Other people won't see them until you publish them: click **Download data.js**, replace `data.js` in this repo with the downloaded file, and commit. **Reset** throws away your browser's edits and reloads `data.js`.
- **Import Excel/CSV** looks for columns called ID, Name, Department, From and To. If the file has a sheet named "Date Wise" it reads that one. Dates are parsed so that dd/mm, mm/dd, Excel serial numbers and year typos all come out right.

## Where the starting data came from

The source is the `Staff Leave tracker.xlsx` file, tab **Date Wise**. Only leaves that fall in 2026 were kept: 81 entries, 4 of which started in late Dec 2025. Dates were normalised as follows:

| Row | Issue in sheet | Used |
|---|---|---|
| Ritesh Nikam, Kamlesh Kumar, Meet Shah (Nov), Ravi Ranjan | entered as mm/dd | read as mm/dd (e.g. 11/21/2026 → 21 Nov) |
| Pratiksha Patil | to 30/11/**2016** | 30 Nov 2026 |
| Omkar Badhe (Sep) | to 3/10/**2016** | 3 Oct 2026 |
| Balaji Kamble (Oct) | to 19/10/**1026** | 19 Oct 2026 |
| Jinal Patel (Aug) | to **80/80/2026** | left blank, flagged red, not drawn until fixed |
| Nikhil Metha (Admin) | no dates | skipped |
| Aman Singh | entered twice (16 Feb–7 Mar and 16 Feb–2 Mar) | later entry approved, earlier one set to pending |
| Vineet Jaiswar (Apr) | ID 6069 | 5169 (his ID everywhere else) |
| Yuvraj Dingh | no department | "Not given" |
| Nikhil Metha (Dec–Jan) | no department | Admin (from his later row) |

## Counting leave days

Sunday is the weekly day off and Saturday is a working day. Leave is counted in calendar days: last day − first day + 1. If a leave **starts** on a Sunday or a public holiday, the count starts on the next working day. For example, a leave entered as 8–20 Nov 2026 (8 Nov is a Sunday, 9–10 Nov is Diwali) is counted from 11 Nov, which gives 10 days. Sundays and holidays that fall inside the leave still count.

## Public holidays

The `HOLIDAY_LIST` in `data.js` holds 2026 and 2027. Eid dates for 2027 are marked as tentative. You can see the whole list on the **Holidays** page (`holidays.html`).

## Approval photos

In the leave form, 📷 opens the phone camera so you can photograph the signed approval form. On a laptop it opens a file picker instead. Attaching a photo ticks **Approved** automatically. Photos are shrunk and stored in **that browser only** (IndexedDB). They are never uploaded to GitHub, so they stay private, but other devices won't see them.

## Hosting

Go to Settings → Pages → Deploy from branch → `main` / root.
