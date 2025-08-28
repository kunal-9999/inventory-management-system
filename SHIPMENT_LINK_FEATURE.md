# Shipment Link Feature

## Overview
The shipment management dashboard now includes a link functionality that allows users to associate external URLs with shipments and open them in new tabs.

## Features Added

### 1. View Button Enhancement
- **Location**: Actions column in the Shipments dashboard
- **Functionality**: Clicking the "🔗 View Content" button fetches and displays the link content directly in the dashboard
- **Visual Indicators**: 
  - 🔗 icon appears when a link is available
  - Button color changes to green when a link exists
  - Tooltip shows "View content from [URL]" when hovering over the button

### 2. Edit Button Enhancement
- **Location**: Actions column in the Shipments dashboard
- **Functionality**: Clicking the "Edit" button opens a modal to edit the shipment link
- **Features**:
  - URL validation (must start with http:// or https://)
  - Default link suggestion based on shipment number
  - Cancel and Save options

### 3. New Link Column
- **Location**: Between Status and Actions columns
- **Display**: Shows whether a shipment has a link available
- **Visual Indicators**:
  - Green badge with 🔗 icon for available links
  - Gray badge for shipments without links

### 4. Link Management Modal
- **Trigger**: Clicking the "Edit" button
- **Features**:
  - URL input field with validation
  - Placeholder text for guidance
  - Cancel and Save buttons
  - Responsive design

### 5. Link Content Viewer Modal
- **Trigger**: Clicking the "🔗 View Content" button
- **Features**:
  - Large modal displaying fetched content
  - Loading spinner while fetching
  - Raw HTML/text content display
  - "Open in New Tab" option for external viewing
  - Source URL display
  - Responsive design with scrollable content

## How to Use

### Adding/Editing Links
1. Navigate to the Shipments dashboard
2. Find the shipment you want to add a link to
3. Click the "Edit" button in the Actions column
4. Enter the URL in the modal (must start with http:// or https://)
5. Click "Save" to confirm or "Cancel" to discard changes

### Viewing Link Content
1. Navigate to the Shipments dashboard
2. Look for shipments with green "🔗 View Content" buttons
3. Click the "🔗 View Content" button to see the link content in a modal
4. The content will be fetched and displayed directly in the dashboard
5. Use "Open in New Tab" to view the original website externally
6. If no link is available, an alert will be shown

### Default Link Pattern
When editing a shipment without a link, the system suggests a default pattern:
```
https://example.com/shipment/{SHIPMENT_NUMBER}
```

## Technical Implementation

### Data Structure
The `Shipment` interface now includes an optional `link` field:
```typescript
interface Shipment {
  // ... existing fields
  link?: string
}
```

### State Management
- `editingLink` state tracks the currently editing link
- Link changes are persisted in the component state
- Links are included in CSV exports

### URL Validation
- Basic validation ensures URLs start with http:// or https://
- Invalid URLs show an alert and prevent saving

## Export Functionality
The CSV export now includes the link column, allowing users to export shipment data with associated links.

## Browser Compatibility
- Uses `fetch()` API to retrieve link content
- Includes CORS handling for cross-origin requests
- "Open in New Tab" option uses `window.open()` with `_blank` target
- Includes `noopener,noreferrer` for security
- Works in all modern browsers

## Future Enhancements
Potential improvements could include:
- Link preview functionality
- Bulk link editing
- Link categorization (tracking, documentation, etc.)
- Link analytics and click tracking
