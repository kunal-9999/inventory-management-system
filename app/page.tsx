"use client"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"

// Dynamically import components with SSR disabled to prevent hydration issues
const ProductManagement = dynamic(() => import("@/components/product-management"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="text-lg text-foreground">Loading Products...</div></div>
})
const DashboardReports = dynamic(() => import("@/components/dashboard-reports").then(mod => ({ default: mod.DashboardReports })), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="text-lg text-foreground">Loading Dashboard...</div></div>
})
const ShipmentManagement = dynamic(() => import("@/components/shipment-management"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="text-lg text-foreground">Loading Shipments...</div></div>
})
const LogisticsTracking = dynamic(() => import("@/components/logistics-tracking"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="text-lg text-foreground">Loading Overseas...</div></div>
})

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [refreshKey, setRefreshKey] = useState(0)

  // Refresh data when switching tabs (but not for products to preserve state)
  useEffect(() => {
    if (activeTab === "dashboard" || activeTab === "shipments" || activeTab === "logistics") {
      setRefreshKey(prev => prev + 1)
    }
  }, [activeTab])

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-5 items-center h-16">
            <div className="flex items-center">
              <img src="/images/nirav-ingredients-logo.png" alt="Nirav Ingredients Logo" className="h-10 w-auto mr-3" />
            </div>
            <div className="flex justify-center col-span-3">
              <h1 className="text-xl font-bold">Inventory Management System</h1>
            </div>
            <nav className="flex justify-end space-x-4">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`hover:text-accent transition-colors ${activeTab === "dashboard" ? "text-accent" : ""}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab("products")}
                className={`hover:text-accent transition-colors ${activeTab === "products" ? "text-accent" : ""}`}
              >
                Products
              </button>
              <button
                onClick={() => setActiveTab("shipments")}
                className={`hover:text-accent transition-colors ${activeTab === "shipments" ? "text-accent" : ""}`}
              >
                Shipments
              </button>
              <button
                onClick={() => setActiveTab("logistics")}
                className={`hover:text-accent transition-colors ${activeTab === "logistics" ? "text-accent" : ""}`}
              >
                Overseas
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
          <DashboardReports key={`dashboard-${refreshKey}`} />
        </div>
        <div style={{ display: activeTab === "products" ? "block" : "none" }}>
          <ProductManagement />
        </div>
        <div style={{ display: activeTab === "shipments" ? "block" : "none" }}>
          <ShipmentManagement key={`shipments-${refreshKey}`} />
        </div>
        <div style={{ display: activeTab === "logistics" ? "block" : "none" }}>
          <LogisticsTracking key={`logistics-${refreshKey}`} />
        </div>
      </main>
    </div>
  )
}
