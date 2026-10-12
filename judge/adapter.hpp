#include <iostream>
#include <vector>
#include <string>
#include <iomanip>
inline int read_int(){int n;std::cin>>n;return n;}
inline std::vector<int> read_vector(){int n=read_int();std::vector<int> v(n);for(int& x:v)std::cin>>x;return v;}
inline std::string read_string(){std::string h,r;std::cin>>h;if(h=="-")return r;for(size_t i=0;i<h.size();i+=2)r+=static_cast<char>(std::stoi(h.substr(i,2),nullptr,16));return r;}
template<class T> void climb_emit(const T& v){std::cout<<v;}
inline void climb_emit(const std::string& s){std::cout<<'"';for(unsigned char c:s){if(c=='"'||c=='\\')std::cout<<'\\'<<c;else if(c<32)std::cout<<"\\u00"<<std::hex<<std::setw(2)<<std::setfill('0')<<int(c)<<std::dec;else std::cout<<c;}std::cout<<'"';}
template<class T> void climb_emit(const std::vector<T>& a){std::cout<<'[';bool first=true;for(const auto& v:a){if(!first)std::cout<<',';first=false;climb_emit(v);}std::cout<<']';}
