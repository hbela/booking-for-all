import Header from "@/components/header";
import Loader from "@/components/loader";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import {
	HeadContent,
	Outlet,
	createRootRouteWithContext,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SentrySmokeTest } from "@/components/SentrySmokeTest";
import { SentryBreakButton } from "@/components/SentryBreakButton";
import { useEffect } from "react";
import "../index.css";

export interface RouterAppContext {}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	head: () => ({
		meta: [
			{
				title: "Booking for All - Appointment Management System",
			},
			{
				name: "description",
				content: "Efficient appointment booking and management platform for businesses and organizations",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1.0",
			},
			{
				property: "og:title",
				content: "Booking for All - Appointment Management System",
			},
			{
				property: "og:description",
				content: "Efficient appointment booking and management platform for businesses and organizations",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: "Booking for All - Appointment Management System",
			},
			{
				name: "twitter:description",
				content: "Efficient appointment booking and management platform for businesses and organizations",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function RootComponent() {
	const isFetching = useRouterState({
		select: (s) => s.isLoading,
	});

	// Debug logging
	useEffect(() => {
		console.log("🔍 RootComponent mounted, isFetching:", isFetching);
		console.log("🔍 DOM content:", document.getElementById("app")?.innerHTML?.length || 0, "chars");
	}, [isFetching]);

	// Dispatch render-complete event for pre-rendering
	useEffect(() => {
		// Wait for router to be ready and content to be loaded
		if (!isFetching) {
			// Small delay to ensure all content is rendered
			const timer = setTimeout(() => {
				console.log("✅ RootComponent: Router loaded, dispatching render-complete");
				document.dispatchEvent(new Event("render-complete"));
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [isFetching]);

	return (
		<>
			<HeadContent />
			<SentrySmokeTest />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<div className="grid grid-rows-[auto_1fr] h-svh">
					<Header />
					{isFetching ? <Loader /> : <Outlet />}
				</div>
				<Toaster richColors />
			</ThemeProvider>
			<SentryBreakButton />
			<TanStackRouterDevtools position="bottom-left" />
		</>
	);
}
