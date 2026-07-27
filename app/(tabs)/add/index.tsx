import { Redirect } from "expo-router";

/** This route exists only to satisfy Expo Router's file-system routing.
 *  The Add tab is hidden from the tab bar (href: null in _layout.tsx).
 *  The FAB on Dashboard and Bills screens navigates to the add-bill modal instead.
 */
export default function AddTabRedirect() {
  return <Redirect href="/add-bill" />;
}
