#!/usr/bin/env python3
"""
Script to test swap functionality by allocating memory
"""
import time
import os

def test_swap():
    print(f"Starting memory allocation test at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Get initial memory stats
    print("Initial memory usage before allocation:")
    os.system("free -h")
    
    print("\nAllocating large array to force swap usage...")
    
    # Create a large list to consume memory (about 1-2GB)
    try:
        # Allocate memory in chunks to monitor usage
        data_chunks = []
        chunk_size = 10000000  # about 80MB per chunk for integers
        target_chunks = 30     # total about 2.4GB if all allocated
        
        for i in range(target_chunks):
            print(f"Allocating chunk {i+1}/{target_chunks}...")
            chunk = [0] * chunk_size
            data_chunks.append(chunk)
            
            # Check memory usage every 5 chunks
            if (i + 1) % 5 == 0:
                print(f"After {i+1} chunks, memory usage:")
                os.system("free -h")
                
    except MemoryError:
        print("Memory allocation stopped due to MemoryError - this is expected when swap is working")
    
    print(f"\nMemory allocation completed at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("Final memory usage:")
    os.system("free -h")
    
    # Keep the memory allocated for a while so we can see the effect
    print("\nKeeping memory allocated for 30 seconds...")
    time.sleep(30)
    
    print("Releasing memory...")
    del data_chunks
    
    print(f"Memory released at {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("Final memory usage after release:")
    os.system("free -h")

if __name__ == "__main__":
    test_swap()