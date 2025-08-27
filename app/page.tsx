"use client"

import ProductManagement from "@/components/product-management"
import { DashboardReports } from "@/components/dashboard-reports"
import { useState } from "react"

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard")

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 items-center h-16">
            <div className="flex items-center">
              <img src="/images/nirav-ingredients-logo.png" alt="Nirav Ingredients Logo" className="h-10 w-auto mr-3" />
            </div>
            <div className="flex justify-center">
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
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && <DashboardReports />}
        {activeTab === "products" && <ProductManagement />}
      </main>
    </div>
  )
}
