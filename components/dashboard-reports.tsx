"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts"
import { TrendingUp, TrendingDown, Package, Users, BarChart3, AlertTriangle, CheckCircle, Filter, X } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface DashboardMetrics {
  totalProducts: number
  totalCustomers: number
  totalSales: number
  totalShipments: number
  currentMonthSales: number
  previousMonthSales: number
  currentMonthShipments: number
  previousMonthShipments: number
  currentMonthDirectShipmentSales: number
  previousMonthDirectShipmentSales: number
  directShipmentsCount: number
}

interface ChartData {
  name: string
  sales: number
  shipments: number
  stock: number
  directShipmentSales: number
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
    currentMonthSales: 0,
    previousMonthSales: 0,
    currentMonthShipments: 0,
    previousMonthShipments: 0,
    currentMonthDirectShipmentSales: 0,
    previousMonthDirectShipmentSales: 0,
    directShipmentsCount: 0,
  })

  const [chartData, setChartData] = useState<ChartData[]>([])
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filter states
  const [selectedProduct, setSelectedProduct] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<{ startDate: string; endDate: string }>({
    startDate: "",
    endDate: ""
  })
  const [showDirectShipments, setShowDirectShipments] = useState<boolean>(false)
  const [availableProducts, setAvailableProducts] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchDashboardData()
  }, [selectedProduct, dateFilter, showDirectShipments])

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
        console.log('[Dashboard] Sample row structure:', mockProductRows[0])
        console.log('[Dashboard] Available month keys:', mockProductRows[0]?.monthly_sales ? Object.keys(mockProductRows[0].monthly_sales) : 'No monthly_sales')
        
        // Extract available products for filtering
        const uniqueProducts = Array.from(new Set(mockProductRows.map((row: any) => row.product.name))).sort() as string[]
        setAvailableProducts(uniqueProducts)
        
        // Apply filters to data
        const filteredRows = applyFilters(mockProductRows)
        
        // Calculate metrics from filtered mock data
        calculateMetricsFromMockData(filteredRows, mockCustomers, mockWarehouses)
        calculateChartDataFromMockData(filteredRows)
        calculateProductPerformanceFromMockData(filteredRows)
        calculateStockAlertsFromMockData(filteredRows)
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

  const applyFilters = (productRows: any[]) => {
    console.log('[Debug] applyFilters called with:', productRows.length, 'rows')
    console.log('[Debug] Selected product:', selectedProduct)
    console.log('[Debug] Date filter:', dateFilter)
    console.log('[Debug] Show direct shipments:', showDirectShipments)
    
    let filteredRows = [...productRows]
    
    // Apply direct shipment filter
    if (showDirectShipments) {
      console.log('[Debug] Filtering for direct shipments only')
      filteredRows = filteredRows.filter(row => row.rowType === "direct_shipment")
      console.log('[Debug] After direct shipment filter:', filteredRows.length, 'rows')
    }
    
    // Apply product filter
    if (selectedProduct !== "all") {
      console.log('[Debug] Filtering by product:', selectedProduct)
      filteredRows = filteredRows.filter(row => row.product.name === selectedProduct)
      console.log('[Debug] After product filter:', filteredRows.length, 'rows')
    }
    
    // Apply date filter (simplified - filtering by months that fall within date range)
    if (dateFilter.startDate && dateFilter.endDate) {
      const startDate = new Date(dateFilter.startDate)
      const endDate = new Date(dateFilter.endDate)
      
      // For each row, filter the monthly data based on date range
      filteredRows = filteredRows.map(row => {
        const filteredMonthlySales: { [key: string]: number } = {}
        const filteredMonthlyShipments: { [key: string]: any[] } = {}
        const filteredMonthlyOpeningStock: { [key: string]: number } = {}
        const filteredMonthlyClosingStock: { [key: string]: number } = {}
        
        // Define month mappings (simplified for demo)
        const monthMappings: { [key: string]: { month: number; year: number } } = {
          'dec24': { month: 12, year: 2024 },
          'jan25': { month: 1, year: 2025 },
          'feb25': { month: 2, year: 2025 },
          'mar25': { month: 3, year: 2025 },
          'apr25': { month: 4, year: 2025 },
          'may25': { month: 5, year: 2025 },
          'jun25': { month: 6, year: 2025 },
          'jul25': { month: 7, year: 2025 },
          'aug25': { month: 8, year: 2025 },
          'sep25': { month: 9, year: 2025 },
          'oct25': { month: 10, year: 2025 },
          'nov25': { month: 11, year: 2025 },
          'dec25': { month: 12, year: 2025 }
        }
        
        Object.keys(row.monthly_sales || {}).forEach(monthKey => {
          const mapping = monthMappings[monthKey]
          if (mapping) {
            const monthDate = new Date(mapping.year, mapping.month - 1, 1)
            if (monthDate >= startDate && monthDate <= endDate) {
              filteredMonthlySales[monthKey] = row.monthly_sales[monthKey]
              filteredMonthlyShipments[monthKey] = row.monthly_shipments?.[monthKey] || []
              filteredMonthlyOpeningStock[monthKey] = row.monthly_opening_stock?.[monthKey] || 0
              filteredMonthlyClosingStock[monthKey] = row.monthly_closing_stock?.[monthKey] || 0
            }
          }
        })
        
        return {
          ...row,
          monthly_sales: filteredMonthlySales,
          monthly_shipments: filteredMonthlyShipments,
          monthly_opening_stock: filteredMonthlyOpeningStock,
          monthly_closing_stock: filteredMonthlyClosingStock
        }
      })
    }
    
    return filteredRows
  }

  const calculateMetricsFromMockData = (productRows: any[], customers: any[], warehouses: any[]) => {
    console.log('[Debug] Calculating metrics for filtered rows:', productRows.length)
    console.log('[Debug] Sample row:', productRows[0])
    
    const totalProducts = new Set(productRows.map(row => row.product.name)).size
    
    // Calculate total customers from filtered product rows instead of using raw customers array
    const totalCustomers = new Set(productRows.map(row => row.customer.name)).size
    
    const totalSales = productRows.reduce((sum, row) => sum + (row.total_sales || 0), 0)
    
    // Calculate total shipments (count of individual shipments, not quantity)
    const totalShipments = productRows.reduce((sum, row) => {
      if (row.monthly_shipments) {
        return sum + Object.values(row.monthly_shipments).reduce((monthSum: number, monthShipments: any) => {
          return monthSum + (Array.isArray(monthShipments) ? monthShipments.length : 0)
        }, 0)
      }
      return sum
    }, 0)
    
    
    // Calculate direct shipments count (count of direct shipment rows)
    const directShipmentsCount = productRows.filter(row => row.rowType === "direct_shipment").length
    
    // Calculate total sales and shipments across ALL months (not just current month)
    const currentMonthSales = productRows.reduce((sum, row) => {
      // Skip direct shipment rows for regular sales calculation
      if (row.rowType === "direct_shipment") return sum
      
      if (row.monthly_sales) {
        const rowTotal = Object.values(row.monthly_sales).reduce((monthSum: number, monthValue: any) => {
          const value = typeof monthValue === 'number' ? monthValue : 0
          return monthSum + value
        }, 0)
        if (rowTotal > 0) {
          console.log(`[Debug] Row ${row.product.name} - Total sales across all months:`, rowTotal)
        }
        return sum + rowTotal
      }
      return sum
    }, 0)
    
    // Calculate direct shipment sales separately
    const currentMonthDirectShipmentSales = productRows.reduce((sum, row) => {
      if (row.rowType === "direct_shipment" && row.monthly_direct_shipment_quantity) {
        const rowTotal = Object.values(row.monthly_direct_shipment_quantity).reduce((monthSum: number, monthValue: any) => {
          const value = typeof monthValue === 'number' ? monthValue : 0
          return monthSum + value
        }, 0)
        if (rowTotal > 0) {
          console.log(`[Debug] Direct Shipment Row ${row.product.name} - Total direct shipment sales across all months:`, rowTotal)
        }
        return sum + rowTotal
      }
      return sum
    }, 0)
    
    // For "previous month" comparison, use total sales - current month sales (simplified)
    const previousMonthSales = Math.max(0, currentMonthSales * 0.8) // Simplified comparison
    const previousMonthDirectShipmentSales = Math.max(0, currentMonthDirectShipmentSales * 0.8) // Simplified comparison
    
    const currentMonthShipments = productRows.reduce((sum, row) => {
      if (row.monthly_shipments) {
        const rowTotal = Object.values(row.monthly_shipments).reduce((monthSum: number, monthShipments: any) => {
          if (Array.isArray(monthShipments)) {
            return monthSum + monthShipments.length // Count individual shipments, not quantities
          }
          return monthSum
        }, 0)
        if (rowTotal > 0) {
          console.log(`[Debug] Row ${row.product.name} - Total shipments across all months:`, rowTotal)
        }
        return sum + rowTotal
      }
      return sum
    }, 0)
    
    const previousMonthShipments = Math.max(0, currentMonthShipments * 0.8) // Simplified comparison
    
    console.log(`[Debug] Final metrics - Sales: ${currentMonthSales}, Shipments: ${currentMonthShipments}`)
    
    setMetrics({
      totalProducts,
      totalCustomers,
      totalSales,
      totalShipments,
      currentMonthSales,
      previousMonthSales,
      currentMonthShipments,
      previousMonthShipments,
      currentMonthDirectShipmentSales,
      previousMonthDirectShipmentSales,
      directShipmentsCount,
    })
  }

  const calculateChartDataFromMockData = (productRows: any[]) => {
    const months = ["dec24", "jan25", "feb25", "mar25", "apr25", "may25", "jun25", "jul25", "aug25", "sep25", "oct25", "nov25", "dec25"]
    const monthLabels = ["Dec 24", "Jan 25", "Feb 25", "Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25"]
    
    const chartData = monthLabels.map((label, index) => {
      const monthKey = months[index]
      const sales = productRows.reduce((sum, row) => {
        // Skip direct shipment rows for regular sales
        if (row.rowType === "direct_shipment") return sum
        return sum + (row.monthly_sales?.[monthKey] || 0)
      }, 0)
      const directShipmentSales = productRows.reduce((sum, row) => {
        if (row.rowType === "direct_shipment") {
          return sum + (row.monthly_direct_shipment_quantity?.[monthKey] || 0)
        }
        return sum
      }, 0)
      const shipments = productRows.reduce((sum, row) => {
        const monthShipments = row.monthly_shipments?.[monthKey] || []
        return sum + (Array.isArray(monthShipments) ? monthShipments.length : 0) // Count individual shipments, not quantities
      }, 0)
      const stock = productRows.reduce((sum, row) => sum + (row.monthly_closing_stock?.[monthKey] || 0), 0)
      
      return { name: label, sales, shipments, stock, directShipmentSales }
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
      
      // Count shipments (individual shipments, not quantities)
      if (row.monthly_shipments) {
        Object.values(row.monthly_shipments).forEach((monthShipments: any) => {
          if (Array.isArray(monthShipments)) {
            product.total_shipments += monthShipments.length // Count individual shipments
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
    
    // Define months in chronological order to find the most recent
    const months = ["dec24", "jan25", "feb25", "mar25", "apr25", "may25", "jun25", "jul25", "aug25", "sep25", "oct25", "nov25", "dec25"]
    
    productRows.forEach(row => {
      // Skip direct shipments from stock levels calculation
      if (row.rowType === "direct_shipment") {
        return
      }
      
      // Find the most recent month with stock data
      let closingStock = 0
      let openingStock = 0
      let mostRecentMonth = ""
      
      // Look for the most recent month with stock data (iterate in reverse order)
      for (let i = months.length - 1; i >= 0; i--) {
        const monthKey = months[i]
        if (row.monthly_closing_stock?.[monthKey] !== undefined && row.monthly_closing_stock[monthKey] !== 0) {
          closingStock = row.monthly_closing_stock[monthKey]
          openingStock = row.monthly_opening_stock?.[monthKey] || 0
          mostRecentMonth = monthKey
          break
        }
      }
      
      const variance = closingStock - openingStock
      
      let status: "low" | "negative" | "normal" = "normal"
      if (closingStock <= 4000) status = "low"
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
        // If we already have an entry for this product-warehouse, update with the higher stock level for display
        const existing = productWarehouseMap.get(key)
        if (closingStock > existing.closing_stock) {
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
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("sales").select("*", { count: "exact", head: true }),
        supabase.from("shipments").select("*", { count: "exact", head: true }),
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

      const currentMonthShipments = currentShipmentsData?.length || 0 // Count individual shipments, not quantities

      // Get previous month shipments
      const { data: previousShipmentsData } = await supabase
        .from("shipments")
        .select("quantity")
        .eq("month", previousMonth)
        .eq("year", previousMonthYear)

      const previousMonthShipments = previousShipmentsData?.length || 0 // Count individual shipments, not quantities

      setMetrics({
        totalProducts: totalProducts || 0,
        totalCustomers: totalCustomers || 0,
        totalSales: totalSales || 0,
        totalShipments: totalShipments || 0,
        currentMonthSales,
        previousMonthSales,
        currentMonthShipments,
        previousMonthShipments,
        currentMonthDirectShipmentSales: 0,
        previousMonthDirectShipmentSales: 0,
        directShipmentsCount: 0,
      })
    } catch (error) {
      console.error("Error fetching metrics:", error)
    }
  }

  const fetchChartData = async () => {
    try {
      const year = new Date().getFullYear()
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

        const totalShipments = shipmentsData?.length || 0 // Count individual shipments, not quantities

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
          directShipmentSales: 0,
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
        .eq("year", new Date().getFullYear())

      const { data: shipmentsData } = await supabase
        .from("shipments")
        .select(`
          quantity,
          product:products(name)
        `)
        .eq("year", new Date().getFullYear())

      // Aggregate data by product
      const productMap = new Map<string, ProductPerformance>()

      // Process sales data
      salesData?.forEach((sale: any) => {
        const productName = sale.product?.name
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
      shipmentsData?.forEach((shipment: any) => {
        const productName = shipment.product?.name
        if (!productMap.has(productName)) {
          productMap.set(productName, {
            product_name: productName,
            total_sales: 0,
            total_shipments: 0,
            customer_count: 0,
          })
        }
        const product = productMap.get(productName)!
        product.total_shipments += 1 // Count individual shipments, not quantities
      })

      // Get customer counts per product
      const { data: customerData } = await supabase.from("product_customers").select(`
        product:products(name),
        customer_id
      `)

      const customerCounts = new Map<string, Set<string>>()
      customerData?.forEach((pc: any) => {
        const productName = pc.product?.name
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

      for (const stock of (stockData as any[]) || []) {
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
        if (stock.closing_stock <= 4000) status = "low"
        if (stock.closing_stock < 0) status = "negative"

        // Create a unique key for product-warehouse combination
        const key = `${stock.product?.name}-${stock.warehouse?.name}`
        
        if (!productWarehouseMap.has(key)) {
          productWarehouseMap.set(key, {
            product_name: stock.product?.name,
            warehouse_name: stock.warehouse?.name,
            closing_stock: stock.closing_stock,
            variance: variance,
            status: status,
          })
        } else {
          // If we already have an entry for this product-warehouse, update with the higher stock level for display
          const existing = productWarehouseMap.get(key)
          if (stock.closing_stock > existing.closing_stock) {
            existing.closing_stock = stock.closing_stock
            existing.variance = variance
            existing.status = status
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

  const getDirectShipmentSalesGrowth = () => {
    if (metrics.previousMonthDirectShipmentSales === 0) return 0
    return ((metrics.currentMonthDirectShipmentSales - metrics.previousMonthDirectShipmentSales) / metrics.previousMonthDirectShipmentSales) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard & Reports</h2>
          <p className="text-foreground mt-1">Comprehensive analytics and insights for your inventory system</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {(selectedProduct !== "all" || dateFilter.startDate || dateFilter.endDate || showDirectShipments) && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                    {[selectedProduct !== "all", dateFilter.startDate || dateFilter.endDate, showDirectShipments].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProduct("all")
                      setDateFilter({ startDate: "", endDate: "" })
                      setShowDirectShipments(false)
                    }}
                    className="h-auto p-1 text-xs"
                  >
                    Clear All
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Name</label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Products" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      {availableProducts.map((product) => (
                        <SelectItem key={product} value={product}>
                          {product}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Show Direct Shipments Only</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="directShipments"
                      checked={showDirectShipments}
                      onChange={(e) => setShowDirectShipments(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="directShipments" className="text-sm text-gray-700">
                      Filter to show only direct shipment data
                    </label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input
                        type="date"
                        placeholder="Start Date"
                        value={dateFilter.startDate}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Input
                        type="date"
                        placeholder="End Date"
                        value={dateFilter.endDate}
                        onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  {dateFilter.startDate && dateFilter.endDate && (
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">
                        {new Date(dateFilter.startDate).toLocaleDateString()} - {new Date(dateFilter.endDate).toLocaleDateString()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDateFilter({ startDate: "", endDate: "" })}
                        className="h-auto p-1"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="bg-slate-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Products</CardTitle>
            <Package className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent className="h-16 flex flex-col justify-end">
            <div className="text-2xl font-bold text-white">{metrics.totalProducts}</div>
            <div className="text-xs text-transparent">placeholder</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent className="h-16 flex flex-col justify-end">
            <div className="text-2xl font-bold text-white">{metrics.totalCustomers}</div>
            <div className="text-xs text-transparent">placeholder</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Sales in Kgs</CardTitle>
            {getSalesGrowth() >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </CardHeader>
          <CardContent className="h-16 flex flex-col justify-end">
            <div className="text-2xl font-bold text-white">{metrics.currentMonthSales.toLocaleString()}</div>
            <p className={`text-xs ${getSalesGrowth() >= 0 ? "text-green-400" : "text-red-400"}`}>
              {getSalesGrowth() >= 0 ? "+" : ""}
              {getSalesGrowth().toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Shipments</CardTitle>
            {getShipmentsGrowth() >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </CardHeader>
          <CardContent className="h-16 flex flex-col justify-end">
            <div className="text-2xl font-bold text-white">{metrics.currentMonthShipments.toLocaleString()}</div>
            <p className={`text-xs ${getShipmentsGrowth() >= 0 ? "text-green-400" : "text-red-400"}`}>
              {getShipmentsGrowth() >= 0 ? "+" : ""}
              {getShipmentsGrowth().toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>


        <Card className="bg-slate-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Direct shipments</CardTitle>
            {getDirectShipmentSalesGrowth() >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </CardHeader>
          <CardContent className="h-16 flex flex-col justify-end">
            <div className="text-2xl font-bold text-white mt-2">{metrics.currentMonthDirectShipmentSales.toLocaleString()}</div>
            <p className={`text-xs ${getDirectShipmentSalesGrowth() >= 0 ? "text-green-400" : "text-red-400"}`}>
              {getDirectShipmentSalesGrowth() >= 0 ? "+" : ""}
              {getDirectShipmentSalesGrowth().toFixed(1)}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Direct Shipments Count</CardTitle>
            <Package className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent className="h-16 flex flex-col justify-end">
            <div className="text-2xl font-bold text-white">{metrics.directShipmentsCount}</div>
            <div className="text-xs text-transparent">placeholder</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Monthly Trends Chart */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-slate-800 font-semibold">Monthly Trends</CardTitle>
              <CardDescription className="text-slate-600">Sales, shipments, and stock levels throughout the year</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="name" stroke="#475569" />
                  <YAxis stroke="#475569" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="sales" stroke="#1e293b" strokeWidth={2} name="Sales" />
                  <Line type="monotone" dataKey="shipments" stroke="#0f172a" strokeWidth={2} name="Shipments" />
                  <Line type="monotone" dataKey="stock" stroke="#334155" strokeWidth={2} name="Stock" />
                  <Line type="monotone" dataKey="directShipmentSales" stroke="#475569" strokeWidth={2} name="Direct Shipment Sales" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Customer Distribution Chart */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-blue-900 font-semibold">Customer Distribution</CardTitle>
              <CardDescription className="text-blue-700">Number of customers per product</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productPerformance.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
                  <XAxis 
                    dataKey="product_name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                    stroke="#1e40af"
                  />
                  <YAxis 
                    domain={[0, 'dataMax']}
                    tickFormatter={(value) => Math.round(value).toString()}
                    allowDecimals={false}
                    stroke="#1e40af"
                  />
                  <Tooltip 
                    formatter={(value, name) => [Math.round(Number(value)), 'Customers']}
                    labelFormatter={(label) => `Product: ${label}`}
                  />
                  <Bar dataKey="customer_count" fill="#1e40af" name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

      {/* Product Performance and Stock Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Product Performance */}
          <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-emerald-900 font-semibold">Product Performance</CardTitle>
              <CardDescription className="text-emerald-700">Top performing products by sales volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productPerformance.slice(0, 5).map((product, index) => (
                  <div key={product.product_name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-sm font-semibold text-emerald-800">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-emerald-900">{product.product_name}</p>
                        <p className="text-sm text-emerald-700">{product.customer_count} customers</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-900">{product.total_sales.toLocaleString()}</p>
                      <p className="text-sm text-emerald-700">sales</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Stock Alerts */}
          <Card className="bg-gradient-to-br from-amber-50 to-yellow-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-amber-900 font-semibold">Stock Levels</CardTitle>
              <CardDescription className="text-amber-700">Current stock levels with alerts for products ≤ 4000</CardDescription>
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
                        {alert.status === "normal" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle
                            className={`h-4 w-4 ${alert.status === "negative" ? "text-red-600" : "text-yellow-600"}`}
                          />
                        )}
                        <div>
                          <p className="font-semibold text-amber-900">{alert.product_name}</p>
                          <p className="text-sm text-amber-700">{alert.warehouse_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-900">{alert.closing_stock.toLocaleString()}</p>
                      {alert.status !== "normal" && (
                        <Badge variant={alert.status === "negative" ? "destructive" : "secondary"}>
                          {alert.status === "negative" ? "Negative" : "Low Stock"}
                        </Badge>
                      )}
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
