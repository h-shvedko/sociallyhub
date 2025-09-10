## ⚙️ Settings

### Refactor Settings UI & Logic

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **SET-001** | Verify Theme Change | 1. Navigate to Settings \> Appearance.\<br\>2. Select the "Dark" theme.\<br\>3. Navigate to other pages (Dashboard, Inbox).\<br\>4. Log out and log back in. | The UI immediately switches to the dark theme. All other pages are in dark mode. The dark theme persists after a new session. |
| **SET-002** | Verify Timezone Application | 1. Navigate to Settings \> Language & Time.\<br\>2. Change the timezone to "UTC-8:00 Pacific Time (US & Canada)".\<br\>3. Go to the Posts page and view a scheduled post's time. | The scheduled time of the post is displayed in the selected Pacific Timezone, correctly converted from its stored UTC value. |
| **SET-003** | Verify Notification Channel Control | 1. Navigate to Settings \> Notifications.\<br\>2. For the "New Inbox Message" notification type, disable the "Email" channel but leave "In-App" enabled.\<br\>3. Have a team member send a new message. | The user receives an in-app notification but does not receive an email notification. |
| **SET-004** | Verify Settings Persistence | 1. Set a unique combination of settings (e.g., Dark theme, German language, a specific timezone).\<br\>2. Log out.\<br\>3. Clear the browser cache.\<br\>4. Log back in. | All previously selected settings (theme, language, timezone) are correctly loaded and applied to the user's session. |

-----

### Develop Client Customization System

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **SET-005** | Admin Configures Client Branding | 1. Log in as a platform **Admin**.\<br\>2. Navigate to the Client Management page.\<br\>3. Select a workspace to edit.\<br\>4. Change the `primaryColor` to a new hex code (e.g., `#FF5733`) and upload a new logo.\<br\>5. Save the changes. | The settings are saved successfully. A success confirmation is shown. |
| **SET-006** | User Views Applied Client Branding | 1. Log in as a regular **User** belonging to the workspace edited in SET-005.\<br\>2. Observe the dashboard header and primary buttons. | The new logo is displayed in the header, and UI elements like primary buttons and links use the new color (`#FF5733`). |
| **SET-007** | Non-Admin Access Control | 1. Log in as a user with an **Admin** (but not platform Admin) or **Member** role.\<br\>2. Attempt to navigate directly to the Client Management URL. | The user is denied access and redirected to their dashboard, possibly with a "Permission Denied" message. |
| **SET-008** | Verify Landing Page CMS Update | 1. As a platform **Admin**, navigate to the CMS editor for a client's landing page.\<br\>2. Change the headline text and publish the changes.\<br\>3. In an incognito window, navigate to that client's landing page URL. | The landing page displays the newly updated headline text. |

## 🆘 Help Center

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **HELP-001** | Search for Help Article | 1. Navigate to the Help page.\<br\>2. In the search bar, type a keyword relevant to an article (e.g., "billing").\<br\>3. Press Enter or wait for results to appear. | A list of help articles and FAQs containing the keyword "billing" is displayed. |
| **HELP-002** | Navigate Help Center Tabs | 1. Go to the Help page.\<br\>2. Click on the `FAQs` tab.\<br\>3. Click on the `Video Tutorials` tab. | The content below the tabs correctly switches to display the list of FAQs and then the video tutorials without a page reload. |
| **HELP-003** | Verify Live Chat Integration | 1. On any page, locate and click the live chat widget icon.\<br\>2. The chat interface should open. | A chat window from the third-party service (e.g., Intercom, Crisp) appears, allowing the user to start a conversation. |

## 💻 Dashboard Widgets

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **DASH-001** | To-Do List Widget Functionality | 1. Have a pending post awaiting approval and an unread message in the inbox.\<br\>2. View the `To-Do List` widget on the dashboard. \<br\>3. Click the "Approve Post" item. | The widget initially shows both items. After clicking, the user is taken to the approval screen, and upon returning to the dashboard, the post approval task is gone from the widget. |
| **DASH-002** | Actionable Insights Widget Links | 1. View the `Actionable Insights` widget.\<br\>2. Click the "Connect a new social account" link. | The user is redirected to the `/dashboard/accounts` page to connect a new account. |
| **DASH-003** | Unified Activity Feed Content | 1. Perform three actions: \<br\>    a) A team member leaves a comment on a post.\<br\>    b) A new inbox message is received.\<br\>    c) A scheduled post fails to publish.\<br\>2. View the activity feed. | All three events (comment, new message, failed post) appear in the feed in chronological order. |

## 📝 Post Composer

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **POST-001**| Platform-Specific Post Preview | 1. In the post composer, add text and an image.\<br\>2. Select both Twitter and Facebook as target platforms.\<br\>3. Toggle the preview between Twitter and Facebook. | The `PostPreview` component updates to accurately reflect the layout, character limits, and image rendering for each selected platform. |
| **POST-002** | AI Hashtag Suggestions | 1. In the post composer, type the caption: "Enjoying a beautiful sunset at the beach."\<br\>2. Wait for the `HashtagSuggestions` component to load. | The component suggests relevant hashtags like `#sunset`, `#beachlife`, `#oceanview`, etc. Clicking a suggestion adds it to the caption. |
| **POST-003** | AI Content Generation | 1. In the post composer, click the "Generate Content with AI" button.\<br\>2. Provide a simple prompt like "a new coffee product launch". | The AI generates a relevant caption for a social media post about a coffee launch, which is then inserted into the editor. |

## 💬 Inbox

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **INBOX-001** | Live Typing Indicator | 1. Log in as User A and User B on different machines.\<br\>2. Both users navigate to the same inbox conversation.\<br\>3. User B types a reply but does not send it. | On User A's screen, a "User B is typing..." indicator appears in the conversation view. The indicator disappears when User B stops typing. |
| **INBOX-002** | Send Attachment in Reply | 1. Open an inbox conversation.\<br\>2. Click the file upload icon in the reply box.\<br\>3. Select a valid image file (e.g., a `.jpg` or `.png`).\<br\>4. Add text and send the reply. | The message is sent successfully with the image attached and visible in the conversation thread. |
| **INBOX-003** | Automated Response Modal UI | 1. Navigate to the Inbox settings.\<br\>2. Click the "Create Automated Response" button.\<br\>3. Observe the modal that appears. | The modal is displayed correctly, with all input fields, labels, and buttons properly aligned and sized, without any visual bugs or overlapping elements. |

## 📈 Analytics Dashboard

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **ANLT-001** | Customize Dashboard Layout | 1. Navigate to the Analytics Dashboard.\<br\>2. Open the `Widget Library` and drag a new widget onto the canvas.\<br\>3. Rearrange existing widgets by dragging them to new positions.\<br\>4. Click the "Save Layout" button. | A success message is shown. When the page is refreshed, the new widget and the rearranged layout are preserved. |
| **ANLT-002** | Chart Tooltip Verification | 1. On the Analytics Dashboard, find a line chart showing follower growth.\<br\>2. Hover your mouse over a specific data point on the line. | A tooltip appears, displaying the exact date and follower count for that specific point. |
| **ANLT-003** | Responsive Chart Scaling | 1. View the Analytics Dashboard on a large desktop monitor.\<br\>2. Resize the browser window to simulate a tablet, then a mobile phone.\<br\>3. Observe the charts. | All charts resize gracefully without breaking the layout. Chart labels and data points remain legible and do not overlap. |

## 🔗 Social Accounts

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **ACCT-001**| Connect Account via API Key | 1. Navigate to `/dashboard/accounts`.\<br\>2. Click "Connect Account" for a platform that supports API key connections.\<br\>3. In the modal, select the `API Key` option.\<br\>4. Enter valid credentials and save. | The modal closes, and the new account appears in the list of connected social accounts with an "Active" status. |
| **ACCT-002** | Expired Token Notification | 1. A previously connected account's token expires (may need to be simulated by a developer).\<br\>2. The user logs in and navigates the dashboard. | An alert or notification appears in the UI, informing the user that "Your [Platform] account needs to be reconnected." |
| **ACCT-003**| Refactored Account Page UI | 1. Navigate to the `/dashboard/accounts` page.\<br\>2. Review the list of platforms. | The page shows a clean, active list of supported platforms. Any mention of "deactivated" status is removed. |

## 🚀 New Functionality

### Client Portal & Billing

| Test Case ID | Test Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **NEW-001** | Client Role Permissions | 1. Log in as a user with the new `Client` role.\<br\>2. Attempt to navigate to the Post Composer, Inbox, or full Analytics Dashboard URLs. | The user is blocked from accessing these pages and is restricted to their simplified, read-only client portal view. |
| **NEW-002** | Share a Password-Protected Report | 1. As a regular user, generate a report.\<br\>2. Use the "Share" feature, select the "Password Protected" option, and set a password.\<br\>3. Copy the generated link and open it in an incognito browser window. | A password prompt is displayed. After entering the correct password, the report is visible. Entering the wrong password shows an error. |
| **NEW-003** | Manage Subscription | 1. Navigate to the `Billing` page.\<br\>2. Click "Change Plan" and select a different subscription tier.\<br\>3. Confirm the selection. | The user's subscription is updated. The "Current Plan" section on the billing page reflects the new tier. |
| **NEW-004** | Update Payment Method | 1. Navigate to the `Billing` page.\<br\>2. Click "Add Payment Method" and enter valid test card details (e.g., from Stripe's test cards).\<br\>3. Set the new card as the default. | The new payment method is added to the list and marked as the default. The old method is now secondary. |
