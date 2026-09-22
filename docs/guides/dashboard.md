# Investigating captured activity

Header totals cover all retained spans, across all services and times. A trace can contain several spans; Sessions counts trace groups separately. Filters apply only to the current view.

Traces, Logs and Timeline show the latest matching records (50 spans or 100 logs/events). Their result count describes the displayed records, not the entire database. Sessions searches session IDs, trace names, agents and services across all pages.

Select a record to inspect it. On narrow windows, the inspector replaces the list; **Back to list** restores it with its filters and scroll position. Trace inspection opens the selected span and a populated detail tab. Error labels distinguish a span's own failure from a failed descendant without changing its type color.

Correlated logs offer **Open trace**, **Copy trace ID**, **Copy span ID**, and, when retained spans supply session context, **Open session**. Open trace selects the correlated span if it is retained. Switch back to Logs or Timeline to return to your previous selection and filters.

**Replay request** makes a new provider request using the server's configured credentials. Unsupported or incomplete captures explain why replay is unavailable. Telemetry-only spans cannot be replayed.

Overview values use compact token and cost formatting. Detail views preserve exact token counts and costs up to eight decimal places; smaller nonzero costs are shown with an upper bound. Timestamps use the browser's local timezone, with precise date/time and timezone available in details and timestamp tooltips. Analytics groups daily activity by UTC date and lists the newest day first.

Models can be sorted by request count or cost and scoped by time. **View traces** reuses the exact time window from the displayed model summary. Metrics show supplied units and identify averages, totals or histogram observation counts; summaries cover all matching retained measurements, while the table shows the latest 100. **View measurements** applies the series' name, service and type filters.

Live investigation views update while open. **Refresh** reloads a view. A failed refresh preserves previous results and shows a warning with **Retry**; initial request failures are distinct from genuinely empty data.
