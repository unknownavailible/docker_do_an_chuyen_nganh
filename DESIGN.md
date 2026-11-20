# Kanban LMS Design System

## Visual direction

Modern Academic Workspace: một giao diện vận hành sáng, điềm tĩnh và có cấu trúc. Nền xanh-xám nhạt làm vùng làm việc; bề mặt chính màu trắng; chữ xanh mực tạo cảm giác học thuật mà vẫn thân thiện.

## Tokens

- Ink: `#17324d`; muted text: `#5b7085`.
- Canvas: `#eef4f8`; surface: `#ffffff`; border: `#d9e4ec`.
- Primary action and selection: `#1769aa`; soft selection: `#e6f1fa`.
- Success: `#19734b`; warning: `#9a5b00`; danger: `#b42318`; review: `#6e56cf`.
- Primary radius: 12–16px for workspace surfaces, 8–11px for controls and cards.
- Depth uses soft, low-opacity blue shadows with vertical offset; borders carry most separation.

## Typography

Inherit Moodle’s UI sans stack. Use compact type hierarchy suitable for an operating surface: 1.55rem workspace title, .95rem column title, standard body text and .68–.82rem metadata. Weight 600–700 is reserved for titles, labels and actions.

## Board composition

- Workspace header states role, board name and next actions.
- Search and quick filters precede the board and report the visible task count.
- Columns are horizontally scrollable at a stable width; mobile shows one substantial column at a time.
- Columns stay neutral. A four-pixel top marker carries workflow identity.
- Cards show priority, title, short description, assignee, deadline, file/comment counts and one “Open” action.

## Dashboard composition

- Dark ink heading anchors the teacher workspace.
- KPI cards remain white; semantic borders identify exceptions without filling whole surfaces.
- Tables use quiet blue-gray headers, clear row rhythm and restrained hover feedback.
- Review and overdue areas remain real Moodle tables for accessibility and responsive overflow.

## Interaction and accessibility

- Keyboard focus uses a visible blue ring; Enter or Space opens a focused card.
- Escape closes custom panels. Dialogs expose `role="dialog"` and `aria-modal="true"`.
- Quick filters use pressed state and an `aria-live` result count.
- Touch layouts provide full-width primary actions and bottom-sheet-style panels.
- Drag-and-drop remains available, while card details and workflow controls provide non-drag actions.

## Implementation boundaries

Use Moodle Mustache, AMD JavaScript, Font Awesome supplied by Moodle and Bootstrap utilities. Do not introduce external fonts, icon libraries or runtime dependencies. Preserve Moodle capabilities, group selection, web-service validation and file areas.
