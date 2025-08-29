"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { TrendingUp, TrendingDown, Package, Users, BarChart3, Calendar, AlertTriangle, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface DashboardMetrics {
  totalProducts: number
  totalCustomers: number
  totalSales: number
  totalShipments: number
  totalStockRecords: number
  currentMonthSales: number
  previousMonthSales: number
  currentMonthShipments: number
  previousMonthShipments: number
}

interface ChartData {
  name: string
  sales: number
  shipments: number
  stock: number
}

interface ProductPerformance {
  product_name: string
  total_sales: number
  total_shipments: number
  customer_count: number
}

interface StockAlert {
  product_name: string
  warehouse_name: string
  closing_stock: number
  variance: number
  status: "low" | "negative" | "normal"
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const CHART_COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#22c55e", "#f97316"]

export function DashboardReports() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProducts: 0,
    totalCustomers: 0,
    totalSales: 0,
    totalShipments: 0,
    totalStockRecords: 0,
    currentMonthSales: 0,
    previousMonthSales: 0,
    currentMonthShipments: 0,
    previousMonthShipments: 0,
  })

  const [chartData, setChartData] = useState<ChartData[]>([])
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedYear])

  useEffect(() => {
    console.log('[Dashboard] Setting up localStorageChange event listener...')
    
    // Listen for localStorage changes to refresh dashboard data
    const handleLocalStorageChange = () => {
      console.log('[Dashboard] Received localStorageChange event, refreshing data...')
      fetchDashboardData()
    }

    window.addEventListener('localStorageChange', handleLocalStorageChange)
    console.log('[Dashboard] Event listener set up successfully')

    return () => {
      window.removeEventListener('localStorageChange', handleLocalStorageChange)
      console.log('[Dashboard] Event listener cleaned up')
    }
  }, [])

  const fetchDashboardData = async () => {
    console.log('[Dashboard] fetchDashboardData called')
    try {
      setLoading(true)
      
      // Try to get data from localStorage first (mock data from Products tab)
      const storedProductData = localStorage.getItem('inventoryProductData')
      const storedCustomerData = localStorage.getItem('inventoryCustomerData')
      const storedWarehouseData = localStorage.getItem('inventoryWarehouseData')
      console.log('[Dashboard] Found stored data:', { 
        productData: !!storedProductData, 
        customerData: !!storedCustomerData, 
        warehouseData: !!storedWarehouseData 
      })
      
      if (storedProductData && storedCustomerData && storedWarehouseData) {
        // Use mock data from Products tab
        const mockProductRows = JSON.parse(storedProductData)
        const mockCustomers = JSON.parse(storedCustomerData)
        const mockWarehouses = JSON.parse(storedWarehouseData)
        
        console.log('[Dashboard] Using mock data, rows:', mockProductRows.length)
        
        // Calculate metrics from mock data
        calculateMetricsFromMockData(mockProductRows, mockCustomers, mockWarehouses)
        calculateChartDataFromMockData(mockProductRows)
        calculateProductPerformanceFromMockData(mockProductRows)
        calculateStockAlertsFromMockData(mockProductRows)
      } else {
        // Fallback to Supabase if no mock data
        await Promise.all([fetchMetrics(), fetchChartData(), fetchProductPerformance(), fetchStockAlerts()])
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateMetricsFromMockData = (productRows: any[], customers: any[], warehouses: any[]) => {
    const totalProducts = new Set(productRows.map(row => row.product.name)).size
    const totalCustomers = customers.length
    const totalSales = productRows.reduce((sum, row) => sum + (row.total_sales || 0), 0)
    
    // Calculate total shipments
    const totalShipments = productRows.reduce((sum, row) => {
      if (row.monthly_shipments) {
        return sum + Object.values(row.monthly_shipments).reduce((monthSum: number, monthShipments: any) => {
          return monthSum + (Array.isArray(monthShipments) ? monthShipments.length : 0)
        }, 0)
      }
      return sum
    }, 0)
    
    const totalStockRecords = productRows.length
    
    // Calculate current month metrics (assuming current month is Jan 25 for demo)
    const currentMonthSales = productRows.reduce((sum, row) => {
      return sum + (row.monthly_sales?.jan25 || 0)
    }, 0)
    
    const previousMonthSales = productRows.reduce((sum, row) => {
      return sum + (row.monthly_sales?.dec24 || 0)
    }, 0)
    
    const currentMonthShipments = productRows.reduce((sum, row) => {
      const monthShipments = row.monthly_shipments?.jan25 || []
      return sum + (Array.isArray(monthShipments) ? monthShipments.length : 0)
    }, 0)
    
    const previousMonthShipments = productRows.reduce((sum, row) => {
      const monthShipments = row.monthly_shipments?.dec24 || []
      return sum + (Array.isArray(monthShipments) ? monthShipments.length : 0)
    }, 0)
    
    setMetrics({
      totalProducts,
      totalCustomers,
      totalSales,
      totalShipments,
      totalStockRecords,
      currentMonthSales,
      previousMonthSales,
      currentMonthShipments,
      previousMonthShipments,
    })
  }

  const calculateChartDataFromMockData = (productRows: any[]) => {
    const months = ["dec24", "jan25", "feb25", "mar25", "apr25", "may25", "jun25", "jul25", "aug25", "sep25", "oct25", "nov25", "dec25"]
    const monthLabels = ["Dec 24", "Jan 25", "Feb 25", "Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25"]
    
    const chartData = monthLabels.map((label, index) => {
      const monthKey = months[index]
      const sales = productRows.reduce((sum, row) => sum + (row.monthly_sales?.[monthKey] || 0), 0)
      const shipments = productRows.reduce((sum, row) => {
        const monthShipments = row.monthly_shipments?.[monthKey] || []
        return sum + (Array.isArray(monthShipments) ? monthShipments.reduce((s: number, shipment: any) => s + (shipment.quantity || 0), 0) : 0)
      }, 0)
      const stock = productRows.reduce((sum, row) => sum + (row.monthly_closing_stock?.[monthKey] || 0), 0)
      
      return { name: label, sales, shipments, stock }
    })
    
    setChartData(chartData)
  }

  const calculateProductPerformanceFromMockData = (productRows: any[]) => {
    const productMap = new Map()
    
    productRows.forEach(row => {
      const productName = row.product.name
      if (!productMap.has(productName)) {
        productMap.set(productName, {
          product_name: productName,
          total_sales: 0,
          total_shipments: 0,
          customer_count: new Set()
        })
      }
      
      const product = productMap.get(productName)
      product.total_sales += row.total_sales || 0
      product.customer_count.add(row.customer.name)
      
      // Count shipments
      if (row.monthly_shipments) {
        Object.values(row.monthly_shipments).forEach((monthShipments: any) => {
          if (Array.isArray(monthShipments)) {
            product.total_shipments += monthShipments.length
          }
        })
      }
    })
    
    const performance = Array.from(productMap.values()).map(product => ({
      ...product,
      customer_count: product.customer_count.size
    }))
    
    setProductPerformance(performance)
  }

  const calculateStockAlertsFromMockData = (productRows: any[]) => {
    const alerts: StockAlert[] = []
    const productWarehouseMap = new Map()
    
    productRows.forEach(row => {
      const closingStock = row.monthly_closing_stock?.dec25 || 0
      const openingStock = row.monthly_opening_stock?.dec25 || 0
      const variance = closingStock - openingStock
      
      let status: "low" | "negative" | "normal" = "normal"
      if (closingStock < 1000) status = "low"
      if (closingStock < 0) status = "negative"
      
      // Create a unique key for product-warehouse combination
      const key = `${row.product.name}-${row.warehouse.name}`
      
      if (!productWarehouseMap.has(key)) {
        productWarehouseMap.set(key, {
          product_name: row.product.name,
          warehouse_name: row.warehouse.name,
          closing_stock: closingStock,
          variance,
          status
        })
      } else {
        // If we already have an alert for this product-warehouse, update with the lower stock level
        const existing = productWarehouseMap.get(key)
        if (closingStock < existing.closing_stock) {
          existing.closing_stock = closingStock
          existing.variance = variance
          existing.status = status
        }
      }
    })
    
    // Convert map values to array
    const uniqueAlerts = Array.from(productWarehouseMap.values())
    setStockAlerts(uniqueAlerts)
  }

  const fetchMetrics = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1
      const currentYear = new Date().getFullYear()
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
      const previousMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

      // Get total counts
      const [
        { count: totalProducts },
        { count: totalCustomers },
        { count: totalSales },
        { count: totalShipments },
        { count: totalStockRecords },
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("sales").select("*", { count: "exact", head: true }),
        supabase.from("shipments").select("*", { count: "exact", head: true }),
        supabase.from("stock_records").select("*", { count: "exact", head: true }),
      ])

      // Get current month sales
      const { data: currentSalesData } = await supabase
        .from("sales")
        .select("quantity")
        .eq("month", currentMonth)
        .eq("year", currentYear)

      const currentMonthSales = currentSalesData?.reduce((sum, sale) => sum + sale.quantity, 0) || 0

      // Get previous month sales
      const { data: previousSalesData } = await supabase
        .from("sales")
        .select("quantity")
        .eq("month", previousMonth)
        .eq("year", previousMonthYear)

      const previousMonthSales = previousSalesData?.reduce((sum, sale) => sum + sale.quantity, 0) || 0

      // Get current month shipments
      const { data: currentShipmentsData } = await supabase
        .from("shipments")
        .select("quantity")
        .eq("month", currentMonth)
        .eq("year", currentYear)

      const currentMonthShipments = currentShipmentsData?.reduce((sum, shipment) => sum + shipment.quantity, 0) || 0

      // Get previous month shipments
      const { data: previousShipmentsData } = await supabase
        .from("shipments")
        .select("quantity")
        .eq("month", previousMonth)
        .eq("year", previousMonthYear)

      const previousMonthShipments = previousShipmentsData?.reduce((sum, shipment) => sum + shipment.quantity, 0) || 0

      setMetrics({
        totalProducts: totalProducts || 0,
        totalCustomers: totalCustomers || 0,
        totalSales: totalSales || 0,
        totalShipments: totalShipments || 0,
        totalStockRecords: totalStockRecords || 0,
        currentMonthSales,
        previousMonthSales,
        currentMonthShipments,
        previousMonthShipments,
      })
    } catch (error) {
      console.error("Error fetching metrics:", error)
    }
  }

  const fetchChartData = async () => {
    try {
      const year = Number.parseInt(selectedYear)
      const monthlyData: ChartData[] = []

      for (let month = 1; month <= 12; month++) {
        // Get sales data
        const { data: salesData } = await supabase.from("sales").select("quantity").eq("month", month).eq("year", year)

        const totalSales = salesData?.reduce((sum, sale) => sum + sale.quantity, 0) || 0

        // Get shipments data
        const { data: shipmentsData } = await supabase
          .from("shipments")
          .select("quantity")
          .eq("month", month)
          .eq("year", year)

        const totalShipments = shipmentsData?.reduce((sum, shipment) => sum + shipment.quantity, 0) || 0

        // Get stock data
        const { data: stockData } = await supabase
          .from("stock_records")
          .select("closing_stock")
          .eq("month", month)
          .eq("year", year)

        const totalStock = stockData?.reduce((sum, stock) => sum + stock.closing_stock, 0) || 0

        monthlyData.push({
          name: MONTHS[month - 1],
          sales: totalSales,
          shipments: totalShipments,
          stock: totalStock,
        })
      }

      setChartData(monthlyData)
    } catch (error) {
      console.error("Error fetching chart data:", error)
    }
  }

  const fetchProductPerformance = async () => {
    try {
      const { data: salesData } = await supabase
        .from("sales")
        .select(`
          quantity,
          product:products(name),
          customer_id
        `)
        .eq("year", Number.parseInt(selectedYear))

      const { data: shipmentsData } = await supabase
        .from("shipments")
        .select(`
          quantity,
          product:products(name)
        `)
        .eq("year", Number.parseInt(selectedYear))

      // Aggregate data by product
      const productMap = new Map<string, ProductPerformance>()

      // Process sales data
      salesData?.forEach((sale) => {
        const productName = sale.product.name
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            product_name: productName,
            total_sales: 0,
            total_shipments: 0,
            customer_count: 0,
          })
        }
        const product = productMap.get(productName)!
        product.total_sales += sale.quantity
      })

      // Process shipments data
      shipmentsData?.forEach((shipment) => {
        const productName = shipment.product.name
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            product_name: productName,
            total_sales: 0,
            total_shipments: 0,
            customer_count: 0,
          })
        }
        const product = productMap.get(productName)!
        product.total_shipments += shipment.quantity
      })

      // Get customer counts per product
      const { data: customerData } = await supabase.from("product_customers").select(`
        product:products(name),
        customer_id
      `)

      const customerCounts = new Map<string, Set<string>>()
      customerData?.forEach((pc) => {
        const productName = pc.product.name
        if (!customerCounts.has(productName)) {
          customerCounts.set(productName, new Set())
        }
        customerCounts.get(productName)!.add(pc.customer_id)
      })

      // Update customer counts
      productMap.forEach((product, productName) => {
        product.customer_count = customerCounts.get(productName)?.size || 0
      })

      const performance = Array.from(productMap.values()).sort((a, b) => b.total_sales - a.total_sales)
      setProductPerformance(performance)
    } catch (error) {
      console.error("Error fetching product performance:", error)
    }
  }

  const fetchStockAlerts = async () => {
    try {
      const { data: stockData } = await supabase
        .from("stock_records")
        .select(`
          closing_stock,
          product:products(name),
          warehouse:warehouses(name),
          product_id,
          warehouse_id,
          month,
          year
        `)
        .eq("year", new Date().getFullYear())
        .order("month", { ascending: false })
        .limit(50)

      const alerts: StockAlert[] = []
      const productWarehouseMap = new Map()

      for (const stock of stockData || []) {
        // Calculate variance (simplified - in real app you'd get actual shipments/sales)
        const { data: salesData } = await supabase
          .from("sales")
          .select("quantity")
          .eq("product_id", stock.product_id)
          .eq("warehouse_id", stock.warehouse_id)
          .eq("month", stock.month)
          .eq("year", stock.year)

        const { data: shipmentsData } = await supabase
          .from("shipments")
          .select("quantity")
          .eq("product_id", stock.product_id)
          .eq("warehouse_id", stock.warehouse_id)
          .eq("month", stock.month)
          .eq("year", stock.year)

        const totalSales = salesData?.reduce((sum, s) => sum + s.quantity, 0) || 0
        const totalShipments = shipmentsData?.reduce((sum, s) => sum + s.quantity, 0) || 0
        const variance = stock.closing_stock - totalShipments + totalSales

        let status: "low" | "negative" | "normal" = "normal"
        if (stock.closing_stock < 100) status = "low"
        if (stock.closing_stock < 0) status = "negative"

        if (status !== "normal") {
          // Create a unique key for product-warehouse combination
          const key = `${stock.product.name}-${stock.warehouse.name}`
          
          if (!productWarehouseMap.has(key)) {
            productWarehouseMap.set(key, {
              product_name: stock.product.name,
              warehouse_name: stock.warehouse.name,
              closing_stock: stock.closing_stock,
              variance: variance,
              status: status,
            })
          } else {
            // If we already have an alert for this product-warehouse, update with the lower stock level
            const existing = productWarehouseMap.get(key)
            if (stock.closing_stock < existing.closing_stock) {
              existing.closing_stock = stock.closing_stock
              existing.variance = variance
              existing.status = status
            }
          }
        }
      }

      // Convert map values to array and show top 10 unique alerts
      const uniqueAlerts = Array.from(productWarehouseMap.values())
      setStockAlerts(uniqueAlerts.slice(0, 10))
    } catch (error) {
      console.error("Error fetching stock alerts:", error)
    }
  }

  const getSalesGrowth = () => {
    if (metrics.previousMonthSales === 0) return 0
    return ((metrics.currentMonthSales - metrics.previousMonthSales) / metrics.previousMonthSales) * 100
  }

  const getShipmentsGrowth = () => {
    if (metrics.previousMonthShipments === 0) return 0
    return ((metrics.currentMonthShipments - metrics.previousMonthShipments) / metrics.previousMonthShipments) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard & Reports</h2>
          <p className="text-foreground mt-1">Comprehensive analytics and insights for your inventory system</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log('=== DASHBOARD EVENT TEST ===')
              console.log('Dispatching test localStorageChange event...')
              window.dispatchEvent(new Event('localStorageChange'))
              console.log('Test event dispatched')
            }}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700"
          >
            Test Event
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalProducts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCustomers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Sales</CardTitle>
            {getSalesGrowth() >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.currentMonthSales.toLocaleString()}</div>
            <p className={`text-xs ${getSalesGrowth() >= 0 ? "text-green-600" : "text-red-600"}`}>
              {getSalesGrowth() >= 0 ? "+" : ""}
              {getSalesGrowth().toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Shipments</CardTitle>
            {getShipmentsGrowth() >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.currentMonthShipments.toLocaleString()}</div>
            <p className={`text-xs ${getShipmentsGrowth() >= 0 ? "text-green-600" : "text-red-600"}`}>
              {getShipmentsGrowth() >= 0 ? "+" : ""}
              {getShipmentsGrowth().toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Records</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalStockRecords}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends ({selectedYear})</CardTitle>
              <CardDescription className="text-foreground">Sales, shipments, and stock levels throughout the year</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#8b5cf6" strokeWidth={2} name="Sales" />
                  <Line type="monotone" dataKey="shipments" stroke="#6366f1" strokeWidth={2} name="Shipments" />
                  <Line type="monotone" dataKey="stock" stroke="#3b82f6" strokeWidth={2} name="Stock" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sales vs Shipments Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales vs Shipments ({selectedYear})</CardTitle>
              <CardDescription className="text-foreground">Monthly comparison of sales and shipments</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#8b5cf6" name="Sales" />
                 <Bar dataKey="shipments" fill="#6366f1" name="Shipments" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

      {/* Product Performance and Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Product Performance ({selectedYear})</CardTitle>
              <CardDescription className="text-foreground">Top performing products by sales volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productPerformance.slice(0, 5).map((product, index) => (
                  <div key={product.product_name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.product_name}</p>
                        <p className="text-sm text-foreground">{product.customer_count} customers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{product.total_sales.toLocaleString()}</p>
                      <p className="text-sm text-foreground">sales</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stock Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Alerts</CardTitle>
              <CardDescription className="text-foreground">Products requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stockAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>All stock levels are normal</span>
                  </div>
                ) : (
                  stockAlerts.map((alert, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          className={`h-4 w-4 ${alert.status === "negative" ? "text-red-600" : "text-yellow-600"}`}
                        />
                        <div>
                          <p className="font-medium">{alert.product_name}</p>
                          <p className="text-sm text-foreground">{alert.warehouse_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{alert.closing_stock.toLocaleString()}</p>
                      <Badge variant={alert.status === "negative" ? "destructive" : "secondary"}>
                        {alert.status === "negative" ? "Negative" : "Low Stock"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
