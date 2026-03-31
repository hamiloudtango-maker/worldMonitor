# Inoreader Design Tokens — Reference

## Colors (Dark Theme)
- `--bg-app`: #131d2a (main background)
- `--bg-sidebar`: #0f1923 (sidebar, darker)
- `--bg-card`: #1a2836 (widget/card background)
- `--bg-card-hover`: #1e2f40
- `--bg-input`: #162230
- `--accent`: #4d8cf5 (blue, active states)
- `--accent-hover`: #3a7be0
- `--accent-gold`: #d4a843 (bookmarks, save)
- `--text-primary`: #c8d6e5
- `--text-secondary`: #6b7d93
- `--text-muted`: #4a5c6f
- `--text-heading`: #e2e8f0
- `--border`: #1e2d3d (subtle)
- `--border-hover`: #2a3f52
- `--danger`: #ef4444
- `--success`: #22c55e

## Sidebar
- Width collapsed: ~50px (icons only)
- Width expanded: ~240px
- Icon size: 20-24px
- Active item: accent blue background subtle
- Badge: red circle on icon

## Typography
- Font: system-ui, -apple-system, sans-serif
- Heading: 24-28px, font-weight 700
- Title: 15-16px, font-weight 600
- Body: 14px, font-weight 400
- Caption: 12px, font-weight 400
- Badge: 10px, font-weight 700

## Cards/Widgets
- Border-radius: 12px
- Padding: 16-20px
- Header: title left + actions right (collapse, refresh, menu)
- Actions: icon buttons, opacity on hover

## Article Card (list view)
- Thumbnail: 100x70px left
- Title: 15px bold
- Source: 12px accent color
- Description: 13px muted
- Time: 12px muted
- Actions: bookmark, seen, menu (right aligned)

## Article Open
- Toolbar: icon bar top (bookmark, tag, comment, AI, copy, headphones, menu | share icons)
- Title: 24px bold
- Meta: source + author + time, 13px
- Body: 15px, line-height 1.7
- Images: full width, no border-radius
- Links: blue accent

## Search
- Two tabs: "IN YOUR ACCOUNT" / "IN ALL PUBLIC FEEDS"
- Scope dropdown + search input + add button
- Filter row: Language, Match, Order, Period
- Results: thumbnail left + content right
- Keyword highlighting in description
