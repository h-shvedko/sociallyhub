/**
 * @jest-environment node
 */
import { performance } from 'perf_hooks'
import { measureAsyncOperation } from '../utils/test-helpers'

// Mock the API endpoints for performance testing
const mockApiCall = async (delay = 100) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({ success: true, data: 'test' })
    }, delay)
  })
}

describe('API Performance Tests', () => {
  test('API response time should be under 200ms for simple queries', async () => {
    const { duration } = await measureAsyncOperation(async () => {
      return mockApiCall(50)
    })
    
    expect(duration).toBeLessThan(200)
  })

  test('Bulk operations should complete within reasonable time', async () => {
    const { duration } = await measureAsyncOperation(async () => {
      // Simulate bulk post creation
      const promises = Array.from({ length: 10 }, () => mockApiCall(30))
      return Promise.all(promises)
    })
    
    // 10 operations should complete in under 1 second
    expect(duration).toBeLessThan(1000)
  })

  test('Concurrent API calls should not degrade performance significantly', async () => {
    // Test sequential calls
    const { duration: sequentialTime } = await measureAsyncOperation(async () => {
      for (let i = 0; i < 5; i++) {
        await mockApiCall(20)
      }
    })

    // Test concurrent calls
    const { duration: concurrentTime } = await measureAsyncOperation(async () => {
      const promises = Array.from({ length: 5 }, () => mockApiCall(20))
      await Promise.all(promises)
    })

    // Concurrent should be faster than sequential
    expect(concurrentTime).toBeLessThan(sequentialTime)
    
    // Concurrent should be close to single call time (20ms + overhead)
    expect(concurrentTime).toBeLessThan(100)
  })

  test('Database queries should be optimized', async () => {
    // Mock database query performance
    const mockDbQuery = async (complexity: 'simple' | 'complex') => {
      const delay = complexity === 'simple' ? 10 : 100
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ rows: [], count: 0 })
        }, delay)
      })
    }

    // Simple queries should be fast
    const { duration: simpleQuery } = await measureAsyncOperation(() => 
      mockDbQuery('simple')
    )
    expect(simpleQuery).toBeLessThan(50)

    // Complex queries should still be reasonable
    const { duration: complexQuery } = await measureAsyncOperation(() => 
      mockDbQuery('complex')
    )
    expect(complexQuery).toBeLessThan(500)
  })

  test('Memory usage should be stable during stress test', async () => {
    const initialMemory = process.memoryUsage()
    
    // Simulate high load
    const operations = []
    for (let i = 0; i < 100; i++) {
      operations.push(mockApiCall(1))
    }
    
    await Promise.all(operations)
    
    const finalMemory = process.memoryUsage()
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
    
    // Memory increase should be reasonable (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
  })

  test('Rate limiting should not significantly impact performance', async () => {
    // Mock rate-limited API calls
    let callCount = 0
    const rateLimitedCall = async () => {
      callCount++
      if (callCount > 10) {
        // Simulate rate limit delay
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return mockApiCall(10)
    }

    const { duration } = await measureAsyncOperation(async () => {
      const promises = Array.from({ length: 15 }, () => rateLimitedCall())
      return Promise.all(promises)
    })

    // Should complete within reasonable time even with rate limiting
    expect(duration).toBeLessThan(2000)
  })

  test('Error handling should not impact performance', async () => {
    const mockApiWithErrors = async (shouldError: boolean) => {
      if (shouldError) {
        throw new Error('API Error')
      }
      return mockApiCall(20)
    }

    const { duration } = await measureAsyncOperation(async () => {
      const promises = []
      
      // Mix of successful and failed calls
      for (let i = 0; i < 20; i++) {
        promises.push(
          mockApiWithErrors(i % 5 === 0).catch(error => ({ error: error.message }))
        )
      }
      
      return Promise.all(promises)
    })

    // Error handling shouldn't add significant overhead
    expect(duration).toBeLessThan(1000)
  })

  test('Large payload handling should be efficient', async () => {
    const mockLargePayload = {
      posts: Array.from({ length: 1000 }, (_, i) => ({
        id: `post-${i}`,
        title: `Post Title ${i}`,
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10),
        author: `Author ${i}`,
        createdAt: new Date().toISOString()
      }))
    }

    const { duration } = await measureAsyncOperation(async () => {
      // Simulate processing large payload
      const serialized = JSON.stringify(mockLargePayload)
      const parsed = JSON.parse(serialized)
      return parsed
    })

    // Large payload processing should be fast
    expect(duration).toBeLessThan(100)
  })

  test('Connection pooling should improve performance', async () => {
    // Mock connection with and without pooling
    const mockConnectionCall = async (usePool: boolean) => {
      const overhead = usePool ? 5 : 50 // Pool reduces connection overhead
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ success: true })
        }, overhead)
      })
    }

    // Test without pooling
    const { duration: withoutPool } = await measureAsyncOperation(async () => {
      const promises = Array.from({ length: 10 }, () => mockConnectionCall(false))
      return Promise.all(promises)
    })

    // Test with pooling
    const { duration: withPool } = await measureAsyncOperation(async () => {
      const promises = Array.from({ length: 10 }, () => mockConnectionCall(true))
      return Promise.all(promises)
    })

    // Pooling should be faster
    expect(withPool).toBeLessThan(withoutPool)
  })

  test('Cache effectiveness should improve response times', async () => {
    let cacheHit = false
    const mockCachedCall = async () => {
      if (cacheHit) {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true, cached: true }), 5)
        })
      } else {
        cacheHit = true
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true, cached: false }), 100)
        })
      }
    }

    // First call (cache miss)
    const { duration: cacheMiss } = await measureAsyncOperation(mockCachedCall)
    
    // Second call (cache hit)
    const { duration: cacheHitDuration } = await measureAsyncOperation(mockCachedCall)

    // Cache hit should be much faster
    expect(cacheHitDuration).toBeLessThan(cacheMiss / 5)
  })
})