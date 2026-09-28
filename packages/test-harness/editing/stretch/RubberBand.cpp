#include "rubberband/RubberBandStretcher.h"
#include <algorithm>
#include <chrono>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>
int main(int argc,char **argv) try {
    if(argc!=7) throw std::runtime_error("input output first end wanted standard|short");
    int first=std::stoi(argv[3]),end=std::stoi(argv[4]),wanted=std::stoi(argv[5]);
    std::string window=argv[6];
    if(first<0||end<=first||end-first>48000*60||wanted<1||wanted>48000*60||(window!="standard"&&window!="short"))throw std::runtime_error("Invalid bounded request");
    std::ifstream source(argv[1],std::ios::binary|std::ios::ate);
    if(!source||source.tellg()<std::streamoff(end)*4)throw std::runtime_error("Missing selected input");
    std::vector<float> input(end-first);source.seekg(std::streamoff(first)*4);source.read(reinterpret_cast<char*>(input.data()),input.size()*4);
    if(!source)throw std::runtime_error("Short selected input");
    using R=RubberBand::RubberBandStretcher;
    int options=R::OptionProcessOffline|R::OptionEngineFiner|R::OptionThreadingNever|R::OptionChannelsTogether;
    if(window=="short")options|=R::OptionWindowShort;
    R engine(48000,1,options,double(wanted)/input.size(),1);
    if(engine.getEngineVersion()!=3)throw std::runtime_error("Expected R3 engine");
    engine.setExpectedInputDuration(input.size());engine.setMaxProcessSize(1024);
    std::vector<float> output;const float* channels[]={input.data()};
    auto began=std::chrono::steady_clock::now();
    bool identity=input.size()==size_t(wanted);
    if(identity)output=input;
    else {
        engine.study(channels,input.size(),true);
        auto drain=[&](){
            int count;
            while((count=engine.available())>0){
                if(output.size()+count>size_t(wanted+48000))throw std::runtime_error("Output exceeded diagnostic bound");
                size_t begin=output.size();output.resize(begin+count);float* dest[]={output.data()+begin};
                if(engine.retrieve(dest,count)!=size_t(count))throw std::runtime_error("No retrieve progress");
            }
        };
        for(size_t index=0;index<input.size();index+=1024){
            size_t count=std::min<size_t>(1024,input.size()-index);channels[0]=input.data()+index;
            engine.process(channels,count,index+count==input.size());drain();
        }
        if(engine.available()!=-1)throw std::runtime_error("Final processing did not terminate");
    }
    double seconds=std::chrono::duration<double>(std::chrono::steady_clock::now()-began).count();
    if(std::ifstream(argv[2]).good())throw std::runtime_error("Output already exists");
    std::ofstream destination(argv[2],std::ios::binary);destination.write(reinterpret_cast<char*>(output.data()),output.size()*4);
    if(!destination)throw std::runtime_error("Write failed");
    std::cout<<"{\"frames\":"<<output.size()<<",\"wanted\":"<<wanted<<",\"engine\":"<<engine.getEngineVersion()<<",\"options\":"<<options<<",\"identity\":"<<(identity?"true":"false")<<",\"renderSeconds\":"<<seconds<<"}\n";
    return 0;
}catch(const std::exception& error){std::cerr<<error.what()<<'\n';return 1;}
