# Hướng dẫn Bundle MinGW vào IDE

## Mục tiêu
Bundle MinGW64 vào app để user **không cần cài đặt gì thêm** - tải về, giải nén, chạy!

## Bước 1: Download MinGW64 Portable

### Option A: WinLibs (Khuyến nghị - nhỏ gọn, mới nhất)
1. Truy cập: https://winlibs.com/
2. Download **GCC 13.x.x + LLVM/Clang/LLD/LLDB + MinGW-w64 (UCRT) - Win64** 
3. Chọn bản **without LLVM** nếu chỉ cần GCC (nhỏ hơn ~200MB)
4. File ZIP khoảng ~100-200MB, giải nén ra ~500MB-1GB

### Option B: TDM-GCC (Như Dev-C++ dùng)
1. Truy cập: https://jmeubank.github.io/tdm-gcc/download/
2. Download **tdm64-gcc-10.3.0-2.exe** (installer)
3. Cài đặt vào folder tạm, ví dụ: `C:\temp\tdm-gcc`
4. Copy folder `C:\temp\tdm-gcc` vào project

### Option C: Dev-C++ MinGW (Đã có sẵn)
1. Nếu đã cài Dev-C++, copy folder: `C:\Program Files (x86)\Dev-Cpp\MinGW64`

## Bước 2: Đặt vào thư mục project

Copy folder MinGW vào thư mục IDE với tên:
```
D:\Code\Project\IDE\
├── mingw64\           <-- ĐẶT Ở ĐÂY
│   ├── bin\
│   │   ├── g++.exe
│   │   ├── gcc.exe
│   │   └── ...
│   ├── include\
│   ├── lib\
│   └── ...
├── main.js
├── src\
└── ...
```

**Các tên folder được hỗ trợ:**
- `Sameko-GCC` (khuyến nghị cho Sameko IDE)
- `mingw64`
- `mingw32`
- `MinGW`
- `compiler`

## Bước 3: Kiểm tra

1. Chạy IDE: `npm start`
2. Xem Terminal, sẽ hiển thị:
   ```
   [System] Compiler: Bundled MinGW 13.x.x
   [System] Precompiled header ready - faster compilation enabled!
   ```

## Bước 4: Build cho distribution

Khi build app (`npm run build`), folder mingw64 sẽ được đóng gói cùng app.

### Lưu ý kích thước:
| Option              | Kích thước | bits/stdc++.h |
| ------------------- | ---------- | ------------- |
| WinLibs minimal     | ~150MB     | ✅ Có          |
| TDM-GCC             | ~300MB     | ✅ Có          |
| Full WinLibs + LLVM | ~800MB     | ✅ Có          |

## Cấu trúc thư mục MinGW cần thiết (tối thiểu)

Để giảm kích thước, bạn chỉ cần giữ:
```
mingw64\
├── bin\
│   ├── g++.exe
│   ├── gcc.exe
│   ├── as.exe
│   ├── ld.exe
│   └── các .dll cần thiết
├── include\
│   ├── c++\           (C++ headers)
│   └── ...
├── lib\
│   ├── gcc\
│   └── ...
└── libexec\           (compiler internals)
```

## Troubleshooting

### "bits/stdc++.h not found"
- Đảm bảo có folder: `mingw64\include\c++\13.x.x\bits\stdc++.h`
- Hoặc sử dụng includes riêng lẻ: `<iostream>`, `<vector>`, etc.

### "g++.exe not found"
- Kiểm tra đường dẫn: `mingw64\bin\g++.exe` phải tồn tại
- Restart IDE sau khi copy folder

### IDE chậm khởi động
- PCH đang được tạo lần đầu (mất ~5-10 giây)
- Các lần sau sẽ nhanh hơn
