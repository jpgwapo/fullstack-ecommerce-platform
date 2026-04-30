import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "../css/app.css";
type Product = {
    id: number;
    name: string;
    category: string;
    description: string;
    price_cents: number;
    stock: number;
    image: string;
};
type User = { id: number; name: string; is_admin: boolean };
type Order = {
    id: number;
    total_cents: number;
    status: string;
    created_at: string;
    items: { name: string; quantity: number }[];
};
type Dashboard = {
    revenue_cents: number;
    orders: number;
    customers: number;
    low_stock: Product[];
    recent_orders: Order[];
};
const money = (c: number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(c / 100);
async function api<T>(
    path: string,
    method = "GET",
    data?: unknown,
): Promise<T> {
    const res = await fetch("/api" + path, {
        method,
        credentials: "same-origin",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-CSRF-TOKEN": document.querySelector<HTMLMetaElement>(
                'meta[name="csrf-token"]',
            )!.content,
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = res.status === 204 ? null : await res.json();
    if (!res.ok)
        throw new Error(
            body?.errors
                ? Object.values(body.errors).flat().join(" ")
                : body?.message || "Something went wrong.",
        );
    return body;
}
function App() {
    const [products, setProducts] = useState<Product[]>([]),
        [user, setUser] = useState<User | null>(null),
        [search, setSearch] = useState(""),
        [category, setCategory] = useState("All essentials"),
        [sort, setSort] = useState("featured"),
        [view, setView] = useState("shop"),
        [modal, setModal] = useState(""),
        [error, setError] = useState(""),
        [notice, setNotice] = useState(""),
        [busy, setBusy] = useState(false),
        [orders, setOrders] = useState<Order[]>([]),
        [dashboard, setDashboard] = useState<Dashboard | null>(null),
        [editing, setEditing] = useState<Product | null>(null);
    const [cart, setCart] = useState<Record<number, number>>(() => {
        try {
            const c = JSON.parse(localStorage.getItem("forma-cart") || "{}");
            return Object.fromEntries(
                Object.entries(c).filter(
                    ([id, q]) =>
                        Number(id) > 0 &&
                        Number.isInteger(q) &&
                        Number(q) > 0 &&
                        Number(q) <= 99,
                ),
            ) as Record<number, number>;
        } catch {
            return {};
        }
    });
    const refresh = () => api<Product[]>("/products").then(setProducts);
    useEffect(() => {
        refresh().catch((e) => setError(e.message));
        api<User>("/user")
            .then(setUser)
            .catch(() => {});
    }, []);
    useEffect(() => {
        localStorage.setItem("forma-cart", JSON.stringify(cart));
    }, [cart]);
    useEffect(() => {
        if (!modal) return;
        const previous = document.activeElement as HTMLElement | null;
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        const controls = () =>
            Array.from(
                dialog?.querySelectorAll<HTMLElement>(
                    "button:not(:disabled), input, select, a[href]",
                ) || [],
            );
        controls()[0]?.focus();
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setModal("");
            if (event.key !== "Tab") return;
            const elements = controls();
            const first = elements[0],
                last = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("keydown", handleKey);
            document.body.style.overflow = original;
            previous?.focus();
        };
    }, [modal]);
    const lines = products.filter((p) => cart[p.id]);
    const total = lines.reduce((s, p) => s + p.price_cents * cart[p.id], 0);
    const count = Object.values(cart).reduce((a, b) => a + b, 0);
    const add = (p: Product) => {
        setCart((c) => ({
            ...c,
            [p.id]: Math.min((c[p.id] || 0) + 1, p.stock),
        }));
        setNotice(`${p.name} added to your bag`);
    };
    async function run(fn: () => Promise<void>) {
        setError("");
        setBusy(true);
        try {
            await fn();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function navigate(next: string) {
        setView(next);
        setError("");
        if (next === "orders")
            await run(async () => setOrders(await api<Order[]>("/orders")));
        if (next === "admin")
            await run(async () =>
                setDashboard(await api<Dashboard>("/admin/dashboard")),
            );
    }
    const filtered = products
        .filter(
            (p) =>
                (category === "All essentials" || p.category === category) &&
                p.name.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) =>
            sort === "low"
                ? a.price_cents - b.price_cents
                : sort === "high"
                  ? b.price_cents - a.price_cents
                  : a.id - b.id,
        );
    async function auth(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.currentTarget));
        await run(async () => {
            setUser(
                await api<User>(
                    modal === "register" ? "/register" : "/login",
                    "POST",
                    data,
                ),
            );
            setModal("");
            location.reload();
        });
    }
    async function checkout(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const shipping = Object.fromEntries(new FormData(e.currentTarget));
        await run(async () => {
            const o = await api<Order>("/checkout", "POST", {
                items: lines.map((p) => ({
                    product_id: p.id,
                    quantity: cart[p.id],
                })),
                shipping,
                payment: "mock",
            });
            setCart({});
            setModal("");
            setNotice(`Order #${o.id} confirmed. Thank you!`);
            await refresh();
            await navigate("orders");
        });
    }
    async function save(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        await run(async () => {
            await api(
                "/admin/products" + (editing ? "/" + editing.id : ""),
                editing ? "PUT" : "POST",
                {
                    ...d,
                    price_cents: Math.round(Number(d.price) * 100),
                    stock: Number(d.stock),
                },
            );
            setModal("");
            await refresh();
            await navigate("admin");
            setNotice("Product saved");
        });
    }
    return (
        <>
            <div className="announcement">
                Thoughtful essentials. Made for your everyday.{" "}
                <span>Free delivery on every order ↗</span>
            </div>
            <header>
                <button className="logo" onClick={() => navigate("shop")}>
                    forma<span>®</span>
                </button>
                <nav>
                    <button
                        className={view === "shop" ? "active" : ""}
                        onClick={() => navigate("shop")}
                    >
                        Shop
                    </button>
                    {user && (
                        <button onClick={() => navigate("orders")}>
                            My orders
                        </button>
                    )}
                    {user?.is_admin && (
                        <button onClick={() => navigate("admin")}>
                            Dashboard
                        </button>
                    )}
                </nav>
                <div className="header-actions">
                    {user ? (
                        <button
                            onClick={() =>
                                run(async () => {
                                    await api("/logout", "POST");
                                    location.reload();
                                })
                            }
                        >
                            Sign out
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setError("");
                                setModal("login");
                            }}
                        >
                            Sign in ↗
                        </button>
                    )}
                    <button
                        className="bag"
                        onClick={() => {
                            setError("");
                            setModal("cart");
                        }}
                    >
                        Bag <span>{count}</span>
                    </button>
                </div>
            </header>
            {error && (
                <div role="alert" className="alert">
                    {error}
                    <button onClick={() => setError("")}>×</button>
                </div>
            )}
            {notice && (
                <div role="status" className="notice">
                    {notice}
                    <button onClick={() => setNotice("")}>×</button>
                </div>
            )}
            <main>
                {view === "shop" ? (
                    <>
                        <section className="hero">
                            <div className="hero-copy">
                                <p className="eyebrow">
                                    LESS, BUT BETTER / THE EVERYDAY COLLECTION
                                </p>
                                <h1>
                                    Good design.
                                    <br />
                                    Better everyday.
                                </h1>
                                <p>
                                    Discover considered essentials for your
                                    space,
                                    <br className="desktop" /> your style, and
                                    everything in between.
                                </p>
                                <a href="#collection" className="primary">
                                    Explore the collection <span>↗</span>
                                </a>
                                <div className="hero-bottom">
                                    <span>01 — 08</span>
                                    <span>
                                        Thoughtfully selected.
                                        <br />
                                        Simply loved.
                                    </span>
                                </div>
                            </div>
                            <div className="hero-image">
                                <img
                                    src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85"
                                    alt="Warm, minimal living room with carefully chosen furnishings"
                                />
                                <div className="image-label">
                                    <span>A little more intention.</span>
                                    <span>THE FORMA EDIT / 2026</span>
                                </div>
                            </div>
                        </section>
                        <section id="collection" className="collection">
                            <div className="section-title">
                                <div>
                                    <p className="eyebrow">
                                        CURATED FOR THE WAY YOU LIVE
                                    </p>
                                    <h2>
                                        Everyday favorites
                                        <span> ({products.length})</span>
                                    </h2>
                                </div>
                                <p>Useful. Beautiful. Yours.</p>
                            </div>
                            <div className="toolbar">
                                <div className="categories">
                                    {[
                                        "All essentials",
                                        "Living",
                                        "Technology",
                                        "Accessories",
                                    ].map((c) => (
                                        <button
                                            key={c}
                                            className={
                                                category === c ? "selected" : ""
                                            }
                                            onClick={() => setCategory(c)}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                                <div className="filters">
                                    <label className="search">
                                        <span>⌕</span>
                                        <input
                                            aria-label="Search products"
                                            placeholder="Search essentials"
                                            value={search}
                                            onChange={(e) =>
                                                setSearch(e.target.value)
                                            }
                                        />
                                    </label>
                                    <select
                                        aria-label="Sort products"
                                        value={sort}
                                        onChange={(e) =>
                                            setSort(e.target.value)
                                        }
                                    >
                                        <option value="featured">
                                            Featured
                                        </option>
                                        <option value="low">
                                            Price: low to high
                                        </option>
                                        <option value="high">
                                            Price: high to low
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div className="product-grid">
                                {filtered.map((p, i) => (
                                    <article key={p.id} className="product">
                                        <div className="product-image">
                                            <img
                                                src={p.image}
                                                alt={p.name}
                                                loading="lazy"
                                            />
                                            {p.stock < 5 ? (
                                                <span className="tag">
                                                    {p.stock
                                                        ? "Only " +
                                                          p.stock +
                                                          " left"
                                                        : "Sold out"}
                                                </span>
                                            ) : (
                                                i === 0 && (
                                                    <span className="tag">
                                                        Bestseller
                                                    </span>
                                                )
                                            )}
                                            <button
                                                aria-label={
                                                    "Add " + p.name + " to bag"
                                                }
                                                disabled={
                                                    !p.stock ||
                                                    cart[p.id] >= p.stock
                                                }
                                                onClick={() => add(p)}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="product-title">
                                            <h3>{p.name}</h3>
                                            <span>{money(p.price_cents)}</span>
                                        </div>
                                        <p>{p.description}</p>
                                        <span className="product-category">
                                            {p.category}
                                        </span>
                                    </article>
                                ))}
                            </div>
                            {!filtered.length && (
                                <div className="empty">
                                    No essentials found. Try another search.
                                </div>
                            )}
                        </section>
                        <section className="values">
                            <div>
                                ↗<h3>Designed to stay</h3>
                                <p>Timeless pieces, beyond the trends.</p>
                            </div>
                            <div>
                                ◇<h3>A considered collection</h3>
                                <p>Fewer things. More meaning.</p>
                            </div>
                            <div>
                                ♡<h3>A little everyday joy</h3>
                                <p>Good design within reach.</p>
                            </div>
                        </section>
                    </>
                ) : view === "orders" ? (
                    <section className="page">
                        <p className="eyebrow">YOUR FORMA COLLECTION</p>
                        <h1>My orders</h1>
                        {!orders.length ? (
                            <div className="empty">
                                Your next everyday favorite is waiting.
                                <button
                                    className="primary"
                                    onClick={() => navigate("shop")}
                                >
                                    Start shopping ↗
                                </button>
                            </div>
                        ) : (
                            orders.map((o) => (
                                <div key={o.id} className="order">
                                    <div>
                                        <h3>Order #{o.id}</h3>
                                        <p>
                                            {new Date(
                                                o.created_at,
                                            ).toLocaleDateString()}{" "}
                                            · {o.status} (mock payment)
                                        </p>
                                        <p>
                                            {o.items
                                                .map(
                                                    (i) =>
                                                        `${i.name} × ${i.quantity}`,
                                                )
                                                .join(" / ")}
                                        </p>
                                    </div>
                                    <strong>{money(o.total_cents)}</strong>
                                </div>
                            ))
                        )}
                    </section>
                ) : (
                    <section className="page">
                        <p className="eyebrow">STORE OVERVIEW</p>
                        <div className="section-title">
                            <h1>Dashboard</h1>
                            <button
                                className="primary"
                                onClick={() => {
                                    setEditing(null);
                                    setModal("product");
                                }}
                            >
                                + New product
                            </button>
                        </div>
                        {dashboard && (
                            <>
                                <div className="stats">
                                    <div>
                                        <p>Total sales</p>
                                        <h2>
                                            {money(dashboard.revenue_cents)}
                                        </h2>
                                    </div>
                                    <div>
                                        <p>Orders</p>
                                        <h2>{dashboard.orders}</h2>
                                    </div>
                                    <div>
                                        <p>Customers</p>
                                        <h2>{dashboard.customers}</h2>
                                    </div>
                                    <div>
                                        <p>Low stock items</p>
                                        <h2>{dashboard.low_stock.length}</h2>
                                    </div>
                                </div>
                                <h2>Product inventory</h2>
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Category</th>
                                                <th>Price</th>
                                                <th>Stock</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map((p) => (
                                                <tr key={p.id}>
                                                    <td>{p.name}</td>
                                                    <td>{p.category}</td>
                                                    <td>
                                                        {money(p.price_cents)}
                                                    </td>
                                                    <td>{p.stock}</td>
                                                    <td>
                                                        <button
                                                            onClick={() => {
                                                                setEditing(p);
                                                                setModal(
                                                                    "product",
                                                                );
                                                            }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditing(p);
                                                                setModal(
                                                                    "delete",
                                                                );
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <h2 className="mt-8">Recent orders</h2>
                                {dashboard.recent_orders.map((o) => (
                                    <div className="order" key={o.id}>
                                        <span>
                                            Order #{o.id} ·{" "}
                                            {o.items
                                                .map((i) => i.name)
                                                .join(", ")}
                                        </span>
                                        <strong>{money(o.total_cents)}</strong>
                                    </div>
                                ))}
                            </>
                        )}
                    </section>
                )}
            </main>
            <footer>
                <div className="logo">
                    forma<span>®</span>
                </div>
                <p>Everyday, elevated.</p>
                <span>© 2026 Forma · A full-stack portfolio project</span>
                <span>React / Laravel / MySQL / Python</span>
            </footer>
            {modal && (
                <div className="overlay" onClick={() => setModal("")}>
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-label={modal}
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className="close"
                            aria-label="Close dialog"
                            onClick={() => setModal("")}
                        >
                            ×
                        </button>
                        {error && (
                            <p role="alert" className="form-error">
                                {error}
                            </p>
                        )}
                        {(modal === "login" || modal === "register") && (
                            <>
                                <p className="eyebrow">WELCOME TO FORMA</p>
                                <h2>
                                    {modal === "login"
                                        ? "Good to see you."
                                        : "Make yourself at home."}
                                </h2>
                                <form onSubmit={auth}>
                                    {modal === "register" && (
                                        <label>
                                            Name
                                            <input
                                                name="name"
                                                autoComplete="name"
                                                required
                                                maxLength={100}
                                            />
                                        </label>
                                    )}
                                    <label>
                                        Email
                                        <input
                                            type="email"
                                            name="email"
                                            autoComplete="email"
                                            required
                                        />
                                    </label>
                                    <label>
                                        Password
                                        <input
                                            type="password"
                                            name="password"
                                            minLength={
                                                modal === "register" ? 10 : 1
                                            }
                                            autoComplete={
                                                modal === "login"
                                                    ? "current-password"
                                                    : "new-password"
                                            }
                                            required
                                        />
                                    </label>
                                    {modal === "register" && (
                                        <label>
                                            Confirm password
                                            <input
                                                type="password"
                                                name="password_confirmation"
                                                autoComplete="new-password"
                                                required
                                            />
                                        </label>
                                    )}
                                    <button className="primary" disabled={busy}>
                                        {busy
                                            ? "Please wait…"
                                            : modal === "login"
                                              ? "Sign in ↗"
                                              : "Create account ↗"}
                                    </button>
                                </form>
                                <button
                                    className="text-button"
                                    onClick={() => {
                                        setError("");
                                        setModal(
                                            modal === "login"
                                                ? "register"
                                                : "login",
                                        );
                                    }}
                                >
                                    {modal === "login"
                                        ? "New here? Create an account"
                                        : "Already a member? Sign in"}
                                </button>
                            </>
                        )}
                        {modal === "cart" && (
                            <>
                                <h2>
                                    Your bag <small>({count})</small>
                                </h2>
                                {!lines.length ? (
                                    <p className="empty">
                                        A little room for something good.
                                    </p>
                                ) : (
                                    <>
                                        {lines.map((p) => (
                                            <div
                                                className="cart-line"
                                                key={p.id}
                                            >
                                                <img
                                                    src={p.image}
                                                    alt={p.name}
                                                />
                                                <div>
                                                    <h3>{p.name}</h3>
                                                    <p>
                                                        {money(p.price_cents)}
                                                    </p>
                                                    <label>
                                                        Qty{" "}
                                                        <input
                                                            aria-label={
                                                                "Quantity for " +
                                                                p.name
                                                            }
                                                            type="number"
                                                            min="1"
                                                            max={p.stock}
                                                            value={cart[p.id]}
                                                            onChange={(e) =>
                                                                setCart(
                                                                    (c) => ({
                                                                        ...c,
                                                                        [p.id]:
                                                                            Math.max(
                                                                                1,
                                                                                Math.min(
                                                                                    p.stock,
                                                                                    Number(
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                    ) ||
                                                                                        1,
                                                                                ),
                                                                            ),
                                                                    }),
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                    <button
                                                        className="text-button"
                                                        onClick={() =>
                                                            setCart((c) => {
                                                                const next = {
                                                                    ...c,
                                                                };
                                                                delete next[
                                                                    p.id
                                                                ];
                                                                return next;
                                                            })
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="order">
                                            <span>Total · Free delivery</span>
                                            <strong>{money(total)}</strong>
                                        </div>
                                        <button
                                            className="primary"
                                            onClick={() => {
                                                setError("");
                                                setModal(
                                                    user ? "checkout" : "login",
                                                );
                                            }}
                                        >
                                            {user
                                                ? "Continue to checkout ↗"
                                                : "Sign in to checkout ↗"}
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                        {modal === "checkout" && (
                            <>
                                <h2>The final little step.</h2>
                                <p className="muted">
                                    Demo checkout · No card details or real
                                    payment.
                                </p>
                                <form onSubmit={checkout}>
                                    {[
                                        ["name", "Full name"],
                                        ["address", "Street address"],
                                        ["city", "City"],
                                        ["postal_code", "Postal code"],
                                    ].map(([name, label]) => (
                                        <label key={name}>
                                            {label}
                                            <input
                                                name={name}
                                                required
                                                maxLength={
                                                    name === "address"
                                                        ? 255
                                                        : 100
                                                }
                                                defaultValue={
                                                    name === "name"
                                                        ? user?.name
                                                        : ""
                                                }
                                            />
                                        </label>
                                    ))}
                                    <div className="order">
                                        <span>Mock payment total</span>
                                        <strong>{money(total)}</strong>
                                    </div>
                                    <button
                                        className="primary"
                                        disabled={busy || !lines.length}
                                    >
                                        {busy
                                            ? "Placing order…"
                                            : "Place mock order ↗"}
                                    </button>
                                </form>
                            </>
                        )}
                        {modal === "product" && (
                            <>
                                <h2>
                                    {editing ? "Edit product" : "New essential"}
                                </h2>
                                <form onSubmit={save}>
                                    {[
                                        ["name", "Name"],
                                        ["category", "Category"],
                                        ["description", "Description"],
                                        ["image", "Image URL"],
                                        ["price", "Price (USD)"],
                                        ["stock", "Inventory"],
                                    ].map(([name, label]) => (
                                        <label key={name}>
                                            {label}
                                            <input
                                                required
                                                name={name}
                                                type={
                                                    name === "price" ||
                                                    name === "stock"
                                                        ? "number"
                                                        : name === "image"
                                                          ? "url"
                                                          : "text"
                                                }
                                                min={
                                                    name === "price"
                                                        ? "0.01"
                                                        : "0"
                                                }
                                                step={
                                                    name === "price"
                                                        ? "0.01"
                                                        : "1"
                                                }
                                                defaultValue={
                                                    editing
                                                        ? name === "price"
                                                            ? editing.price_cents /
                                                              100
                                                            : editing[
                                                                  name as keyof Product
                                                              ]
                                                        : ""
                                                }
                                            />
                                        </label>
                                    ))}
                                    <button className="primary" disabled={busy}>
                                        Save product ↗
                                    </button>
                                </form>
                            </>
                        )}
                        {modal === "delete" && (
                            <>
                                <h2>Delete {editing?.name}?</h2>
                                <p>
                                    This removes the product from the catalog.
                                </p>
                                <button
                                    className="primary"
                                    disabled={busy}
                                    onClick={() =>
                                        run(async () => {
                                            await api(
                                                "/admin/products/" +
                                                    editing?.id,
                                                "DELETE",
                                            );
                                            setModal("");
                                            await refresh();
                                            await navigate("admin");
                                        })
                                    }
                                >
                                    Delete product
                                </button>
                            </>
                        )}
                    </section>
                </div>
            )}
        </>
    );
}
createRoot(document.getElementById("root")!).render(<App />);
