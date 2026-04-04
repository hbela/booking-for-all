declare const prisma: import("../prisma/generated/runtime/library.js").DynamicClientExtensionThis<import("../prisma/generated/index.js").Prisma.TypeMap<import("../prisma/generated/runtime/library.js").InternalArgs & {
    result: {};
    model: {};
    query: {};
    client: {};
}, {}>, import("../prisma/generated/index.js").Prisma.TypeMapCb<{
    log: ("error" | "warn")[];
    datasources: {
        db: {
            url: string;
        };
    } | undefined;
}>, {
    result: {};
    model: {};
    query: {};
    client: {};
}>;
export default prisma;
