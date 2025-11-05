import apiClient from '@/lib/api-client';

export interface Customer {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export const customersService = {
  async getCustomers(): Promise<Customer[]> {
    const response = await apiClient.get('/customers');
    return response.data.customers;
  },

  async getCustomer(id: string): Promise<Customer> {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data.customer;
  },

  async createCustomer(data: {
    name: string;
    description?: string;
    color?: string;
  }): Promise<Customer> {
    const response = await apiClient.post('/customers', data);
    return response.data.customer;
  },

  async updateCustomer(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
    }
  ): Promise<Customer> {
    const response = await apiClient.put(`/customers/${id}`, data);
    return response.data.customer;
  },

  async deleteCustomer(id: string) {
    const response = await apiClient.delete(`/customers/${id}`);
    return response.data;
  },
};
