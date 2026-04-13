# Regression Prevention Rules

Guidelines for maintaining UI stability and preventing regressions in critical features and automated recordings.

## 1. Global Event Listening

### Rule: Mandatory Visibility Checks

When adding global event listeners (e.g., `document.addEventListener('paste', ...)`), you **MUST** ensure the current component instance is visible before processing the event.

> [!IMPORTANT]
> Failure to check visibility causes duplicate event processing in responsive layouts where multiple instances (e.g., Mobile and Desktop) are mounted simultaneously but toggled via `display: none` / `hidden`.

**Implementation Pattern:**

- Use a `ref` on the main container of the component.
- Check `ref.current.offsetParent !== null` inside the event handler.

```tsx
const handleGlobalEvent = (e: Event) => {
  // ❌ BAD: Triggers once for every mounted instance
  // ✅ GOOD: Only triggers for the visible instance
  if (containerRef.current && containerRef.current.offsetParent === null) return;
  
  // Process event...
};
```

---

## 2. Navigation Lifecycle & State Cleanup

### Rule: Explicit Toast/Modal Dismissal

When triggering a navigation that unmounts active components (e.g., `router.push`), you **MUST** explicitly dismiss any persistent UI elements (like loading toasts) immediately before the navigation call.

> [!WARNING]
> Do not rely solely on `finally` blocks in async functions or `useEffect` cleanups if the navigation happens inside the same function. In some React environments, the component can unmount before the `finally` block resolves or the cleanup executes reliably.

**Implementation Pattern:**

```tsx
const handleAction = async () => {
  const loadingToast = toast.loading("Processing...");
  try {
    await performUpload();
    // ✅ Always dismiss proactively before navigation
    toast.dismiss(loadingToast);
    router.push('/success');
  } finally {
    // Only use for fallback cleanup or local state reset
    setIsLoading(false);
  }
};
```

---

## 3. Page Mount Guards

### Rule: Initial State Resets

Customizing or interactive pages **MUST** clear any potentially orphaned global state or toasts in their initial mount (`useEffect` with empty deps).

> [!TIP]
> This ensures that if a previous page's dismissal failed, the new page starts with a clean slate for the user.

**Implementation Pattern:**

```tsx
useEffect(() => {
  // Clear any carry-over UI artifacts
  toast.dismiss();
  // ... other resets
}, []);
```

## 4. Breadcrumb and Navigation Hierarchy

### Rule: Consistent Return Paths

Always verify that breadcrumbs or "back" buttons in deep-level clients (like `CustomizingClient`) point to the correct contextual parent (e.g., Shop vs. Landing page) to avoid breaking recording flows that rely on specific navigation backtracking.
