"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Filter, Calendar } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

interface Product {
  id: string
  name: string
  unit: string
}

interface Customer {
  id: string
  name: string
}

interface Warehouse {
  id: string
  name: string
}

interface Sale {
  id: string
  product_id: string
  customer_id: string
  warehouse_id: string
  month: number
  year: number
  quantity: number
  unit: string
  created_at: string
  product: Product
  customer: Customer
  warehouse: Warehouse
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function SalesManagement() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // Filter states
  const [filters, setFilters] = useState({
    month: "",
    year: new Date().getFullYear().toString(),
    product_id: "",
    customer_id: "",
    warehouse_id: "",
  })

  // Form states
  const [saleForm, setSaleForm] = useState({
    product_id: "",
    customer_id: "",
    warehouse_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    quantity: "",
    unit: "Kgs",
  })

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchFilteredSales()
  }, [filters])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, unit")
        .order("name")

      if (productsError) throw productsError
      setProducts(productsData || [])

      // Fetch customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, name")
        .order("name")

      if (customersError) throw customersError
      setCustomers(customersData || [])

      // Fetch warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from("warehouses")
        .select("id, name")
        .order("name")

      if (warehousesError) throw warehousesError
      setWarehouses(warehousesData || [])

      // Initial sales fetch
      await fetchFilteredSales()
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFilteredSales = async () => {
    try {
      let query = supabase
        .from("sales")
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)
        .order("created_at", { ascending: false })

      // Apply filters
      if (filters.year) {
        query = query.eq("year", Number.parseInt(filters.year))
      }
      if (filters.month) {
        query = query.eq("month", Number.parseInt(filters.month))
      }
      if (filters.product_id) {
        query = query.eq("product_id", filters.product_id)
      }
      if (filters.customer_id) {
        query = query.eq("customer_id", filters.customer_id)
      }
      if (filters.warehouse_id) {
        query = query.eq("warehouse_id", filters.warehouse_id)
      }

      const { data, error } = await query

      if (error) throw error
      setSales(data || [])
    } catch (error) {
      console.error("Error fetching sales:", error)
    }
  }

  const handleCreateSale = async () => {
    try {
      const { data, error } = await supabase
        .from("sales")
        .insert([
          {
            ...saleForm,
            quantity: Number.parseFloat(saleForm.quantity),
          },
        ])
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      setSales([data[0], ...sales])
      setSaleForm({
        product_id: "",
        customer_id: "",
        warehouse_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        quantity: "",
        unit: "Kgs",
      })
      setIsSaleDialogOpen(false)
    } catch (error) {
      console.error("Error creating sale:", error)
    }
  }

  const handleUpdateSale = async () => {
    if (!selectedSale) return

    try {
      const { data, error } = await supabase
        .from("sales")
        .update({
          ...saleForm,
          quantity: Number.parseFloat(saleForm.quantity),
        })
        .eq("id", selectedSale.id)
        .select(`
          *,
          product:products(id, name, unit),
          customer:customers(id, name),
          warehouse:warehouses(id, name)
        `)

      if (error) throw error

      setSales(sales.map((s) => (s.id === selectedSale.id ? data[0] : s)))
      setSaleForm({
        product_id: "",
        customer_id: "",
        warehouse_id: "",
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        quantity: "",
        unit: "Kgs",
      })
      setSelectedSale(null)
      setIsSaleDialogOpen(false)
    } catch (error) {
      console.error("Error updating sale:", error)
    }
  }

  const handleDeleteSale = async (saleId: string) => {
    try {
      const { error } = await supabase.from("sales").delete().eq("id", saleId)

      if (error) throw error

      setSales(sales.filter((s) => s.id !== saleId))
    } catch (error) {
      console.error("Error deleting sale:", error)
    }
  }

  const openEditDialog = (sale: Sale) => {
    setSelectedSale(sale)
    setSaleForm({
      product_id: sale.product_id,
      customer_id: sale.customer_id,
      warehouse_id: sale.warehouse_id,
      month: sale.month,
      year: sale.year,
      quantity: sale.quantity.toString(),
      unit: sale.unit,
    })
    setIsSaleDialogOpen(true)
  }

  const openNewSaleDialog = () => {
    setSelectedSale(null)
    setSaleForm({
      product_id: "",
      customer_id: "",
      warehouse_id: "",
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      quantity: "",
      unit: "Kgs",
    })
    setIsSaleDialogOpen(true)
  }

  const clearFilters = () => {
    setFilters({
      month: "",
      year: new Date().getFullYear().toString(),
      product_id: "",
      customer_id: "",
      warehouse_id: "",
    })
  }

  const getTotalSales = () => {
    return sales.reduce((total, sale) => total + sale.quantity, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted">Loading sales data...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Sales Management</h2>
          <p className="text-muted mt-1">Track and manage monthly sales records</p>
        </div>
        <Button onClick={openNewSaleDialog} className="bg-secondary hover:bg-secondary/90">
          <Plus className="h-4 w-4 mr-2" />
          Record Sale
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter sales records by various criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={filters.year} onValueChange={(value) => setFilters({ ...filters, year: value })}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={filters.month} onValueChange={(value) => setFilters({ ...filters, month: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="All months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All months</SelectItem>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product</Label>
              <Select
                value={filters.product_id}
                onValueChange={(value) => setFilters({ ...filters, product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All products</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={filters.customer_id}
                onValueChange={(value) => setFilters({ ...filters, customer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All customers</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Warehouse</Label>
              <Select
                value={filters.warehouse_id}
                onValueChange={(value) => setFilters({ ...filters, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sales.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalSales().toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filters.month ? MONTHS[Number.parseInt(filters.month) - 1] : "All"} {filters.year}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Records</CardTitle>
          <CardDescription>View and manage all sales transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted" />
                      {MONTHS[sale.month - 1]} {sale.year}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{sale.product.name}</TableCell>
                  <TableCell>{sale.customer.name}</TableCell>
                  <TableCell>{sale.warehouse.name}</TableCell>
                  <TableCell className="font-mono">{sale.quantity.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sale.unit}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(sale)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSale(sale.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sale Dialog */}
      <Dialog open={isSaleDialogOpen} onOpenChange={setIsSaleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSale ? "Edit Sale" : "Record New Sale"}</DialogTitle>
            <DialogDescription>{selectedSale ? "Update sale information" : "Add a new sales record"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Product</Label>
              <Select
                value={saleForm.product_id}
                onValueChange={(value) => {
                  const product = products.find((p) => p.id === value)
                  setSaleForm({
                    ...saleForm,
                    product_id: value,
                    unit: product?.unit || "Kgs",
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select product</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer">Customer</Label>
              <Select
                value={saleForm.customer_id}
                onValueChange={(value) => setSaleForm({ ...saleForm, customer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select
                value={saleForm.warehouse_id}
                onValueChange={(value) => setSaleForm({ ...saleForm, warehouse_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Select warehouse</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="month">Month</Label>
                <Select
                  value={saleForm.month.toString()}
                  onValueChange={(value) => setSaleForm({ ...saleForm, month: Number.parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Select month</SelectItem>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={month} value={(index + 1).toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={saleForm.year}
                  onChange={(e) => setSaleForm({ ...saleForm, year: Number.parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={saleForm.quantity}
                  onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={saleForm.unit} onValueChange={(value) => setSaleForm({ ...saleForm, unit: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kgs">Kgs</SelectItem>
                    <SelectItem value="Lbs">Lbs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={selectedSale ? handleUpdateSale : handleCreateSale}
              className="bg-secondary hover:bg-secondary/90"
            >
              {selectedSale ? "Update" : "Record"} Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
